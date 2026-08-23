import { normalizeMessage } from './message/normalize.js';
import { parseCommand } from './commands/parse.js';
import { getCommand, registerCommand } from './commands/registry.js';
import { ChatbotState } from './state/chatbot-state.js';
import { resolveRole, hasRole } from './permissions/roles.js';
import { handleChatbotMessage } from '../ai/chatbot-service.js';
import { RateLimiter } from './rate-limit.js';

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

    const role = resolveRole({
      sender: message.senderJid,
      ownerJids: this.ownerJids,
      sudoJids: this.sudoJids,
      isGroupAdmin: Boolean(raw.isGroupAdmin),
    });

    const parsed = parseCommand(message.text, ['.']);
    if (parsed) {
      const command = getCommand(parsed.name);
      if (!command) return { handled: false, reason: 'unknown-command' };
      const requiredRole = command.role ?? 'user';
      if (!hasRole(role, requiredRole)) {
        await this.reply(message.chatJid, 'You do not have permission to use this command.');
        return { handled: true, type: 'permission-denied' };
      }

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
      return { handled: true, type: 'command', command: parsed.name };
    }

    if (this.chatbot.isEnabled(message.chatJid)) {
      // Per-user cooldown protects API quotas and mobile data.
      const limitKey = `chatbot:${message.senderJid}`;
      if (!this.limiter.allow(limitKey)) {
        return { handled: false, reason: 'rate-limited' };
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
