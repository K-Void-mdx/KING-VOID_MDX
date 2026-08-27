import { normalizeMessage } from './message/normalize.js';
import { parseCommand } from './commands/parse.js';
import { getCommand, registerCommand } from './commands/registry.js';
import { ChatbotState } from './state/chatbot-state.js';
import { resolveRole, hasRole } from './permissions/roles.js';
import { handleChatbotMessage } from '../ai/chatbot-service.js';
import { isChatbotTrigger, stripBotMention } from '../ai/chatbot.js';
import { RateLimiter } from './rate-limit.js';
import { normalizeJid } from './permissions/roles.js';
import { isBroadcastChat } from './jid.js';
import * as waStyle from '../ui/wa-style.js';

const OUTBOUND_MEMORY = 500;
const SEEN_MEMORY = 800;

export class NovaApplication {
  constructor({
    botJid,
    botLid,
    ownerJids = [],
    sudoJids = [],
    ai,
    sessions,
    memory,
    reply,
    sendMedia,
    send,
    chatbot,
    limiter,
    prefixes = ['.'],
    botName = 'NOVA_VOID MDX',
    trace = () => {},
  }) {
    this.botJid = botJid;
    // WhatsApp may address the linked account through an alternate LID
    // identity; kept for mention-matching only — never for authority.
    this.botLid = botLid;
    this.ownerJids = ownerJids;
    this.sudoJids = sudoJids;
    this.ai = ai;
    this.sessions = sessions;
    this.memory = memory;
    // ONE transport + ONE tracking owner. NovaApplication wraps the raw
    // transport so every outbound message is echo-registered here, never at
    // call sites — a tracking failure must never fail a command.
    this.transportSend = send ?? reply;
    if (typeof this.transportSend !== 'function') {
      throw new Error('NovaApplication requires a send/reply transport');
    }
    this.transportSendMedia = typeof sendMedia === 'function' ? sendMedia : undefined;
    this.sendMedia = this.transportSendMedia
      ? async (chatJid, media) => {
          const sent = await this.transportSendMedia(chatJid, media);
          this.trackOutbound(sent);
          return sent;
        }
      : undefined;
    this.chatbot = chatbot ?? new ChatbotState();
    this.limiter = limiter ?? new RateLimiter({ windowMs: 15_000, max: 4 });
    this.prefixes = Array.isArray(prefixes) && prefixes.length ? prefixes : ['.'];
    this.botName = botName;
    this.trace = trace;
    // IDs of messages THIS bot sent, so the companion echo of our own replies
    // is never re-dispatched. Human-typed messages (even fromMe) have fresh
    // ids and pass through for normal configured-role dispatch.
    this.outboundIds = new Set();
    // IDs of INBOUND messages already processed — Baileys can replay the same
    // message after a reconnect, which must never double-fire a command.
    this.seenIds = new Set();
  }

  /** Raw send, wrapped with guaranteed outbound tracking. */
  async reply(chatJid, text, { quoted } = {}) {
    const sent = await this.transportSend(chatJid, { text, quoted });
    this.trackOutbound(sent);
    return sent;
  }

  /**
   * Sends text as a threaded reply (quote) to an inbound WhatsApp message.
   * The `quoted` payload is the original WebMessageInfo, so WhatsApp renders
   * the bot's reply attached to the person who addressed it — making clear
   * exactly who the bot is talking to in a group.
   */
  async replyTo(message, text) {
    const quoted = message?.raw && (message.raw.key || message.raw.message)
      ? message.raw
      : undefined;
    return this.reply(message.chatJid, text, { quoted });
  }

  trackOutbound(sent) {
    try {
      const id = sent?.key?.id;
      if (!id) return;
      this.rememberOutbound(id);
    } catch (error) {
      // Bookkeeping must never break message flow.
      try { this.trace('track-error', { error }); } catch { /* ignore */ }
    }
  }

  rememberOutbound(id) {
    if (!id) return;
    this.outboundIds.add(id);
    if (this.outboundIds.size > OUTBOUND_MEMORY) {
      const oldest = this.outboundIds.values().next().value;
      this.outboundIds.delete(oldest);
    }
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
    if (!message.id) return { handled: false, reason: 'ignored' };
    if (isBroadcastChat(message.chatJid)) return { handled: false, reason: 'ignored-status' };
    if (message.isProtocol) return { handled: false, reason: 'protocol' };

    // Echo suppression is ID-based, never role-based: only messages THIS bot
    // actually sent are skipped. A human typing on the linked phone produces
    // fresh ids, passes this gate, and is then dispatched strictly by their
    // CONFIGURED role (companion identity grants no authority).
    if (message.fromMe && this.outboundIds.has(message.id)) {
      return { handled: false, reason: 'self-echo' };
    }
    if (this.seenIds.has(message.id)) {
      return { handled: false, reason: 'duplicate' };
    }
    this.seenIds.add(message.id);
    if (this.seenIds.size > SEEN_MEMORY) {
      const oldest = this.seenIds.values().next().value;
      this.seenIds.delete(oldest);
    }
    if (!message.text) return { handled: false, reason: 'no-text' };
    this.trace('message', message);

    const role = resolveRole({
      sender: message.senderJid,
      ownerJids: this.ownerJids,
      sudoJids: this.sudoJids,
      isGroupAdmin: Boolean(raw.isGroupAdmin),
    });

    const parsed = parseCommand(message.text, this.prefixes);
    if (parsed) {
      const command = getCommand(parsed.name);
      if (!command) {
        this.trace('unknown-command', { name: parsed.name });
        return { handled: false, reason: 'unknown-command' };
      }
      const requiredRole = command.role ?? 'user';
      if (!hasRole(role, requiredRole)) {
        await this.reply(message.chatJid, waStyle.accessDenied(parsed.name, requiredRole));
        return { handled: true, type: 'permission-denied', role, requiredRole };
      }

      this.trace('dispatch', { name: parsed.name });
      try {
        await command.execute({
          message,
          senderJid: message.senderJid,
          chatJid: message.chatJid,
          args: parsed.args,
          argsText: parsed.text,
          role,
          reply: (text) => this.reply(message.chatJid, text),
          replyTo: (text) => this.replyTo(message, text),
          sendMedia: this.sendMedia ? (media) => this.sendMedia(message.chatJid, media) : undefined,
        });
        this.trace('response', { command: parsed.name });
      } catch (error) {
        // Real details stay in Termux logs; users get a clean card with no
        // internal error text.
        this.trace('command-error', { command: parsed.name, error });
        await this.reply(message.chatJid, waStyle.commandError(parsed.name));
        return { handled: true, type: 'command-error', error };
      }
      return { handled: true, type: 'command', command: parsed.name };
    }

    if (this.chatbot.isEnabled(message.chatJid)) {
      // In DMs with chatbot enabled, every message is a chatbot prompt.
      // In groups, only explicit addressment (@mention or reply to the bot)
      // may reach the AI layer; ordinary chatter must never consume budget.
      const isDm = !message.isGroup;
      const mentioned = (message.mentionedJids ?? [])
        .some((jid) => [this.botJid, this.botLid]
          .some((id) => id && normalizeJid(jid) === normalizeJid(id)));
      const prompted = isDm || isChatbotTrigger(message, this.botJid, this.botLid) || mentioned;
      const prompt = isDm
        ? message.text
        : stripBotMention(message.text, this.botJid, { mentioned });
      if (!prompted || !prompt) {
        return { handled: false, reason: 'no-trigger' };
      }
      const limitKey = `chatbot:${message.chatJid}:${message.senderJid}`;
      if (!this.limiter.allow(limitKey)) {
        // Notify at most once per window so spam cannot turn into echo spam.
        const notifyKey = `notify:${limitKey}`;
        if (this.limiter.allow(notifyKey)) {
          await this.reply(message.chatJid, waStyle.rateLimited());
        }
        return { handled: true, type: 'rate-limited' };
      }
      const replied = await handleChatbotMessage({
        message,
        botJid: this.botJid,
        botLid: this.botLid,
        enabled: true,
        ai: this.ai,
        // DMs: every inbound message is a prompt (no mention required).
        force: !message.isGroup,
        // In groups the bot quotes the sender's message, so its reply visibly
        // targets the person who addressed it rather than floating in the chat.
        reply: (text) => (message.isGroup ? this.replyTo(message, text) : this.reply(message.chatJid, text)),
      });
      if (replied) return { handled: true, type: 'chatbot' };
    }

    return { handled: false, reason: 'no-trigger' };
  }
}
