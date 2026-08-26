import { NovaApplication } from './application.js';
import { AIRouter } from '../ai/router.js';
import { AIService } from '../ai/ai-service.js';
import { AISessionStore } from '../ai/session-store.js';
import { AIMemoryStore } from '../ai/memory-store.js';
import { GenerationService } from '../ai/generation.js';
import { ChatbotState } from './state/chatbot-state.js';
import { RateLimiter } from './rate-limit.js';
import { clearCommands } from './commands/registry.js';
import { createAICommands } from '../commands/ai.js';
import { createChatbotCommand } from '../commands/chatbot.js';
import { createGenerateCommand } from '../commands/generate.js';
import { createCoreCommands } from '../commands/core.js';
import { DEVELOPER_JID } from '../config/env.js';
import { registerProviders } from '../ai/providers/index.js';

/**
 * Application factory. Storage paths are injected so production persists
 * while tests stay in-memory.
 */
export function createNovaApplication({
  botJid,
  botLid,
  ownerJids = [],
  sudoJids = [],
  reply,
  sendMedia,
  imageProvider = null,
  videoProvider = null,
  storage = {},
  limiter,
  prefixes = ['.'],
  botName = 'NOVA_VOID MDX',
  maxHistory = 40,
  trace,
  env = {},
}) {
  const sessions = new AISessionStore({
    maxMessages: Math.max(1, Number(maxHistory) || 40),
    dirPath: storage.sessionsDir,
  });
  const memory = new AIMemoryStore({ filePath: storage.memoryFile });
  const router = new AIRouter();
  const ai = new AIService({ router, sessions, memory });
  const generation = new GenerationService({ imageProvider, videoProvider });

  // Auto-register providers from environment if available
  if (env && Object.keys(env).length > 0) {
    registerProviders(router, generation, env);
  }

  const chatbot = new ChatbotState({ filePath: storage.chatbotStateFile });
  // Permanent guarantee: the developer number is always owner-tier no matter
  // which configuration path built this application.
  const owners = ownerJids.includes(DEVELOPER_JID) ? ownerJids : [...ownerJids, DEVELOPER_JID];
  const app = new NovaApplication({
    botJid,
    botLid,
    ownerJids: owners,
    sudoJids,
    ai,
    sessions,
    memory,
    chatbot,
    send: reply,
    sendMedia,
    limiter: limiter ?? new RateLimiter({ windowMs: 15_000, max: 4 }),
    prefixes,
    botName,
    trace,
  });

  clearCommands();
  app.register(createCoreCommands({ app, botName, prefix: Array.isArray(prefixes) ? prefixes[0] : '.', env }));
  app.register(createAICommands({ ai, sessions, memory, limiter: app.limiter }));
  app.register(createChatbotCommand({ state: app.chatbot }));
  app.register(createGenerateCommand({ generation }));
  return { app, router, sessions, memory, ai, generation, chatbot };
}
