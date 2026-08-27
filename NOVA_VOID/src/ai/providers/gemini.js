import { AIProvider, AIProviderError } from '../provider.js';

/**
 * Google Gemini REST API adapter.
 * Uses the generateContent endpoint for text generation.
 */
export class GeminiProvider extends AIProvider {
  #apiKey;
  #model;
  #timeout;

  constructor({ apiKey, model = 'gemini-3.6-flash', timeoutMs = 30_000 }) {
    super('gemini');
    this.#apiKey = apiKey;
    this.#model = model;
    this.#timeout = timeoutMs;
  }

  get model() {
    return this.#model;
  }

  async generateText({ messages, userJid, scope }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeout);

    try {
      // Convert OpenAI message format to Gemini format
      const contents = this.#convertMessages(messages);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.#model}:generateContent?key=${this.#apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.7,
            },
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new AIProviderError(
          `Gemini HTTP ${response.status}: ${body.slice(0, 200)}`,
          { provider: 'gemini' }
        );
      }

      const data = await response.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new AIProviderError('Gemini returned empty content', { provider: 'gemini' });
      }
      return { text: content, provider: 'gemini' };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (error?.name === 'AbortError') {
        throw new AIProviderError(`Gemini timed out after ${this.#timeout}ms`, { provider: 'gemini' });
      }
      throw new AIProviderError(`Gemini request failed: ${error?.message ?? error}`, {
        provider: 'gemini',
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Convert OpenAI-style messages to Gemini contents format.
   * System messages become a user turn prepended to the conversation.
   */
  #convertMessages(messages) {
    const contents = [];
    let systemParts = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Prepend system instruction as first user turn
    if (systemParts.length > 0) {
      contents.unshift({
        role: 'user',
        parts: [{ text: systemParts.join('\n\n') }],
      });
    }

    // Gemini requires alternating user/model turns
    // Merge consecutive same-role turns
    const merged = [];
    for (const turn of contents) {
      const last = merged[merged.length - 1];
      if (last && last.role === turn.role) {
        last.parts[0].text += '\n\n' + turn.parts[0].text;
      } else {
        merged.push(turn);
      }
    }

    // Must start with user
    if (merged.length > 0 && merged[0].role !== 'user') {
      merged.unshift({ role: 'user', parts: [{ text: '(context)' }] });
    }

    return merged.length > 0 ? merged : [{ role: 'user', parts: [{ text: 'Hello' }] }];
  }
}
