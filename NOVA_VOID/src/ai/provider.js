export class AIProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AIProviderError';
    this.provider = options.provider;
    this.cause = options.cause;
  }
}

/**
 * Provider contract. Concrete providers should implement generateText().
 * API credentials must come from environment/configuration, never source code.
 */
export class AIProvider {
  constructor(name) {
    this.name = name;
  }

  async generateText() {
    throw new AIProviderError(`Provider "${this.name}" does not implement generateText()`, {
      provider: this.name,
    });
  }
}
