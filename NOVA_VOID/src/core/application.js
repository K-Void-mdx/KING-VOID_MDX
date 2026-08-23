import { normalizeMessage } from './message/normalize.js';
import { parseCommand } from './commands/parse.js';
import { getCommand, registerCommand } from './commands/registry.js';
import { ChatbotState } from './state/chatbot-state.js';
import { resolveRole, hasRole } from './permissions/roles.js';
import { handleChatbotMessage } from '../ai/chatbot-service.js';
import { isChatbotTrigger, stripBotMention } from '../ai/chatbot.js';
import { RateLimiter } from './rate-limit.js';
import { normalizeJid } from './permissions/roles.js';

export class NovaApplication {
  constructor({
    botJid,
    ownerJids = [],
    sudoJids = [],
    ai,
    sessions,
    memory,
    reply,
    sendMedia,
    chatbot,
    limiter,
    prefixes = ['.'],
    botName = 'NOVA_VOID MDX',
  }) {
    this.botJid = botJid;
    this.ownerJids = ownerJids;
    this.sudoJids = sudoJids;
    this.ai = ai;
    this.sessions = sessions;
    this.memory = memory;
    this.reply = reply;
    this.sendMedia = sendMedia;
    this.chatbot = chatbot ?? new ChatbotState();
    this.limiter = limiter ?? new RateLimiter({ windowMs: 15_000, max: 4 });
    this.prefixes = Array.isArray(prefixes) && prefixes.length ? prefixes : ['.'];
    this.botName = botName;
  }

  register(commands) {
    const list = Array.isArray(commands) ? commands.flat(Infinity) : [commands];
    for (const command of list) {
      if (command) registerCommand(command);
    }
    return this;
  }

  async handle(raw) {
    const message = normalizeMessage(raw, { botJid: this.botJid });
    if (!message.id || message.isFromBot) return { handled: false, reason: 'ignored' };
    if (message.chatJid === 'status@broadcast') return { handled: false, reason: 'ignored-status' };

    const role = resolveRole({
      sender: message.senderJid,
      ownerJids: this.ownerJids,
      sudoJids: this.sudoJids,
      isGroupAdmin: Boolean(raw.isGroupAdmin),
    });

    const parsed = parseCommand(message.text, this.prefixes);
    if (parsed) {
      const command = getCommand(parsed.name);
      if (!command) return { handled: false, reason: 'unknown-command' };
      const requiredRole = command.role ?? 'user';
      if (!hasRole(role, requiredRole)) {
        await this.reply(message.chatJid, 'You do not have permission to use this command.');
        return { handled: true, type: 'permission-denied' };
      }

      try {
        await command.execute({
          message,
          senderJid: message.senderJid,
          chatJid: message.chatJid,
          args: parsed.args,
          argsText: parsed.text,
          role,
          reply: (text) => this.reply(message.chatJid, text),
          sendMedia: this.sendMedia ? (media) => this.sendMedia(message.chatJid, media) : undefined,
        });
      } catch (error) {
        await this.reply(
          message.chatJid,
          `Command "${parsed.name}" failed: ${error?.message ?? 'unknown error'}`
        );
        return { handled: true, type: 'command-error', error };
      }
      return { handled: true, type: 'command', command: parsed.name };
    }

    if (this.chatbot.isEnabled(message.chatJid)) {
      // Only explicit addressment (@mention or reply to the bot) may reach the AI
      // layer; ordinary chatter must never consume rate-limit budget.
      const mentioned = (message.mentionedJids ?? [])
        .some((jid) => normalizeJid(jid) === normalizeJid(this.botJid));
      const prompt = stripBotMention(message.text, this.botJid, { mentioned });
      if ((!isChatbotTrigger(message, this.botJid) && !mentioned) || !prompt) {
        return { handled: false, reason: 'no-trigger' };
      }
      const limitKey = `chatbot:${message.chatJid}:${message.senderJid}`;
      if (!this.limiter.allow(limitKey)) {
        // Notify at most once per window so spam cannot turn into echo spam.
        const notifyKey = `notify:${limitKey}`;
        if (this.limiter.allow(notifyKey)) {
          await this.reply(message.chatJid, 'You are messaging NOVA_VOID too quickly. Please slow down a little.');
        }
        return { handled: true, type: 'rate-limited' };
      }
      const replied = await handleChatbotMessage({
        message,
        botJid: this.botJid,
        enabled: true,
        ai: this.ai,
        reply: (text) => this.reply(message.chatJid, text),
      });
      if (replied) return { handled: true, type: 'chatbot' };
    }

    return { handled: false, reason: 'no-trigger' };
  }
}
