import { findKnowledge } from './knowledge.js';

const DEFAULT_PERSONALITY = `You are NOVA_VOID MDX, a helpful AI assistant on WhatsApp. You are friendly, concise, and direct. Never say you are Claude, GPT, or any other model. Your name is NOVA_VOID MDX. Keep responses short and natural for WhatsApp chat. Use simple formatting that works on WhatsApp. When you mention a bot command, render the command name in small-caps Unicode exactly like these examples, keeping the dot prefix: .ᴘɪɴɢ, .ᴍᴇɴᴜ, .ꜱᴛᴀᴛᴜꜱ, .ᴀɪ <question>, .ɢᴇɴᴇʀᴀᴛᴇ <prompt>, .ʜɪꜱᴛᴏʀʏ, .ᴄʟᴇᴀʀ-ʜ [all], .ᴛʀᴀɪɴ <information>. Do not format your own prose in small caps — only command names.`;

export class AIService {
  constructor({ router, sessions, memory, personality = DEFAULT_PERSONALITY }) {
    this.router = router;
    this.sessions = sessions;
    this.memory = memory;
    this.personality = personality;
  }

  /**
   * Best-effort answer from trained global knowledge when no provider exists.
   * Returns { content } or null. Never fakes provider output.
   */
  answerFromKnowledge(prompt) {
    const hit = findKnowledge(this.memory, prompt);
    return hit ? { content: hit.record.content } : null;
  }

  async chat({ userJid, prompt, scope = 'private', provider, systemPrompt = '' }) {
    const session = this.sessions.ensure(userJid, scope);
    const knowledge = [
      ...this.memory.listAll('global'),
      ...this.memory.list(userJid, 'bot'),
    ].map((item) => item.content);
    const messages = [
      { role: 'system', content: systemPrompt || this.personality },
      ...(knowledge.length ? [{ role: 'system', content: `Bot memory:\n${knowledge.join('\n')}` }] : []),
      ...session.messages.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: prompt },
    ];

    const result = await this.router.generateText({ messages, userJid, scope }, { provider });
    const answer = typeof result === 'string' ? result : result?.text ?? result?.content ?? '';
    if (!answer) throw new Error('AI provider returned an empty response');

    this.sessions.append(userJid, { role: 'user', content: prompt }, scope);
    this.sessions.append(userJid, { role: 'assistant', content: answer }, scope);
    return answer;
  }
}
