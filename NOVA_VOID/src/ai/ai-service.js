import { findKnowledge } from './knowledge.js';

export class AIService {
  constructor({ router, sessions, memory }) {
    this.router = router;
    this.sessions = sessions;
    this.memory = memory;
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
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
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
