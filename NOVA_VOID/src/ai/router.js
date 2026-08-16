import { AIProviderError } from './provider.js';

export class AIRouter {
  #providers = new Map();
  #order = [];

  register(provider) {
    if (!provider?.name || typeof provider.generateText !== 'function') {
      throw new TypeError('AI provider must expose a name and generateText()');
    }
    this.#providers.set(provider.name, provider);
    if (!this.#order.includes(provider.name)) this.#order.push(provider.name);
    return this;
  }

  remove(name) {
    this.#providers.delete(name);
    this.#order = this.#order.filter((item) => item !== name);
    return this;
  }

  list() {
    return [...this.#order];
  }

  async generateText(request, { provider } = {}) {
    const names = provider ? [provider] : this.#order;
    if (!names.length) {
      throw new AIProviderError('No AI providers are configured');
    }

    let lastError;
    for (const name of names) {
      const selected = this.#providers.get(name);
      if (!selected) continue;
      try {
        return await selected.generateText(request);
      } catch (error) {
        lastError = error;
      }
    }

    throw new AIProviderError('All configured AI providers failed', { cause: lastError });
  }
}
