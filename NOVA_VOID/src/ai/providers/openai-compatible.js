import { AIProvider, AIProviderError } from '../provider.js';

/**
 * Generic OpenAI-compatible chat completions adapter.
 * Works with: Groq, OpenRouter, OpenCode Zen, and any OpenAI-compatible endpoint.
 */
export class OpenAICompatibleProvider extends AIProvider {
  #baseUrl;
  #apiKey;
  #model;
  #timeout;

  constructor({ name, baseUrl, apiKey, model, timeoutMs = 30_000 }) {
    super(name);
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
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
      const response = await fetch(`${this.#baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.#apiKey}`,
        },
        body: JSON.stringify({
          model: this.#model,
          messages,
          max_tokens: 2048,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new AIProviderError(
          `${this.name} HTTP ${response.status}: ${body.slice(0, 200)}`,
          { provider: this.name }
        );
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new AIProviderError(`${this.name} returned empty content`, { provider: this.name });
      }
      return { text: content, provider: this.name };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (error?.name === 'AbortError') {
        throw new AIProviderError(`${this.name} timed out after ${this.#timeout}ms`, { provider: this.name });
      }
      throw new AIProviderError(`${this.name} request failed: ${error?.message ?? error}`, {
        provider: this.name,
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
