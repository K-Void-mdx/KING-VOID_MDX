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

/**
 * Application factory. Storage paths are injected so production persists
 * while tests stay in-memory.
 */
export function createNovaApplication({
  botJid,
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
}) {
  const sessions = new AISessionStore({
    maxMessages: Math.max(1, Number(maxHistory) || 40),
    dirPath: storage.sessionsDir,
  });
  const memory = new AIMemoryStore({ filePath: storage.memoryFile });
  const router = new AIRouter();
  const ai = new AIService({ router, sessions, memory });
  const generation = new GenerationService({ imageProvider, videoProvider });
  const chatbot = new ChatbotState({ filePath: storage.chatbotStateFile });
  const app = new NovaApplication({
    botJid,
    ownerJids,
    sudoJids,
    ai,
    sessions,
    memory,
    chatbot,
    reply,
    sendMedia,
    limiter: limiter ?? new RateLimiter({ windowMs: 15_000, max: 4 }),
    prefixes,
    botName,
  });

  clearCommands();
  app.register(createCoreCommands({ app, botName, prefix: Array.isArray(prefixes) ? prefixes[0] : '.' }));
  app.register(createAICommands({ ai, sessions, memory }));
  app.register(createChatbotCommand({ state: app.chatbot }));
  app.register(createGenerateCommand({ generation }));
  return { app, router, sessions, memory, ai, generation, chatbot };
}
