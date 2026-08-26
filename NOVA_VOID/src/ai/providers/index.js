import { OpenAICompatibleProvider } from './openai-compatible.js';
import { GeminiProvider } from './gemini.js';
import { GeminiImageProvider } from './gemini-image.js';

/**
 * Provider registration factory.
 * Reads environment variables and registers all configured providers
 * into the router (text) and generation service (image/video).
 *
 * Failover order: Gemini → Groq → OpenCode Zen → OpenRouter
 */
export function registerProviders(router, generation, env) {
  const registered = [];

  // ── Gemini (primary) ──────────────────────────────────────────────
  if (env.geminiApiKey) {
    const gemini = new GeminiProvider({ apiKey: env.geminiApiKey });
    router.register(gemini);
    registered.push('gemini');

    // Gemini also handles image generation
    if (generation && !generation.imageProvider) {
      generation.imageProvider = new GeminiImageProvider({ apiKey: env.geminiApiKey });
    }
  }

  // ── Groq (backup — fast inference, free tier) ─────────────────────
  if (env.groqApiKey) {
    const groq = new OpenAICompatibleProvider({
      name: 'groq',
      baseUrl: 'https://api.groq.com/openai',
      apiKey: env.groqApiKey,
      model: 'llama-3.3-70b-versatile',
    });
    router.register(groq);
    registered.push('groq');
  }

  // ── OpenCode Zen (tertiary — free models available) ───────────────
  if (env.openCodeApiKey) {
    const zen = new OpenAICompatibleProvider({
      name: 'opencode-zen',
      baseUrl: 'https://opencode.ai/zen/v1',
      apiKey: env.openCodeApiKey,
      model: 'mimo-v2.5-free', // Free model
    });
    router.register(zen);
    registered.push('opencode-zen');
  }

  // ── OpenRouter (quaternary — pay per use, many models) ────────────
  if (env.openRouterApiKey) {
    const openrouter = new OpenAICompatibleProvider({
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: env.openRouterApiKey,
      model: 'meta-llama/llama-3.3-70b-instruct:free',
    });
    router.register(openrouter);
    registered.push('openrouter');
  }

  console.error(`[ AI ] Registered providers: ${registered.length ? registered.join(', ') : 'NONE'}`);
  return registered;
}

/**
 * Provider status report for diagnostics.
 */
export function getProviderStatus(env) {
  return {
    gemini: { configured: Boolean(env.geminiApiKey), role: 'primary + image gen' },
    groq: { configured: Boolean(env.groqApiKey), role: 'backup (fast)' },
    'opencode-zen': { configured: Boolean(env.openCodeApiKey), role: 'tertiary (free models)' },
    openrouter: { configured: Boolean(env.openRouterApiKey), role: 'quaternary (pay-per-use)' },
  };
}
