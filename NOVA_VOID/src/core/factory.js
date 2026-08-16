import { NovaApplication } from './application.js';
import { AIRouter } from '../ai/router.js';
import { AIService } from '../ai/ai-service.js';
import { AISessionStore } from '../ai/session-store.js';
import { AIMemoryStore } from '../ai/memory-store.js';
import { GenerationService } from '../ai/generation.js';
import { createPermissionChecker } from './permissions/check.js';
import { clearCommands } from './commands/registry.js';
import { createAICommands } from '../commands/ai.js';
import { createChatbotCommand } from '../commands/chatbot.js';
import { createGenerateCommand } from '../commands/generate.js';

export function createNovaApplication({ botJid, ownerJids = [], sudoJids = [], reply, sendMedia, imageProvider = null, videoProvider = null }) {
  const sessions = new AISessionStore();
  const memory = new AIMemoryStore();
  const router = new AIRouter();
  const ai = new AIService({ router, sessions, memory });
  const generation = new GenerationService({ imageProvider, videoProvider });
  const permissions = createPermissionChecker({ ownerJids, sudoJids });
  const app = new NovaApplication({ botJid, ownerJids, sudoJids, ai, sessions, memory, reply, sendMedia });

  clearCommands();
  app.register(createAICommands({ ai, sessions, memory, permissions }));
  app.register(createChatbotCommand({ state: app.chatbot, permissions }));
  app.register(createGenerateCommand({ generation }));
  return { app, router, sessions, memory, ai, generation };
}
