import { AIProviderError } from '../provider.js';

/**
 * Image generation service using Gemini's native image generation.
 * Falls back to a "not configured" message if no provider is available.
 */
export class GeminiImageProvider {
  #apiKey;
  #model;
  #timeout;

  constructor({ apiKey, model = 'gemini-2.0-flash-preview-image-generation', timeoutMs = 60_000 }) {
    this.#apiKey = apiKey;
    this.#model = model;
    this.#timeout = timeoutMs;
  }

  async generate({ prompt }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeout);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.#model}:generateContent?key=${this.#apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `Generate an image: ${prompt}` }] }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
            },
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new AIProviderError(
          `Gemini image HTTP ${response.status}: ${body.slice(0, 200)}`,
          { provider: 'gemini-image' }
        );
      }

      const data = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];

      // Extract image from parts
      for (const part of parts) {
        if (part.inlineData?.data) {
          const buffer = Buffer.from(part.inlineData.data, 'base64');
          const mimeType = part.inlineData.mimeType || 'image/png';
          const extension = mimeType.split('/')[1] || 'png';
          return {
            buffer,
            mimeType,
            filename: `nova-image-${Date.now()}.${extension}`,
          };
        }
      }

      throw new AIProviderError('Gemini returned no image data', { provider: 'gemini-image' });
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (error?.name === 'AbortError') {
        throw new AIProviderError(`Gemini image timed out after ${this.#timeout}ms`, { provider: 'gemini-image' });
      }
      throw new AIProviderError(`Gemini image failed: ${error?.message ?? error}`, {
        provider: 'gemini-image',
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
