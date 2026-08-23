import { AIProviderError } from '../ai/provider.js';

const NOT_CONFIGURED = /no ai providers are configured/i;

export function createAICommands({ ai, sessions, memory, limiter }) {
  return [
    {
      name: 'ai',
      aliases: ['ask'],
      category: 'ai',
      usage: '.ai <question>',
      async execute(ctx) {
        if (!ctx.argsText) return ctx.reply('Usage: .ai <question>');
        const limitKey = `cmd:ai:${ctx.senderJid}`;
        if (limiter && !limiter.allow(limitKey)) {
          const seconds = Math.ceil(limiter.msUntilAllowed(limitKey) / 1000);
          return ctx.reply(`Please wait ${seconds}s before asking again.`);
        }
        try {
          return ctx.reply(await ai.chat({ userJid: ctx.senderJid, prompt: ctx.argsText, scope: ctx.chatJid }));
        } catch (error) {
          if (error instanceof AIProviderError && NOT_CONFIGURED.test(error.message)) {
            return ctx.reply('No AI provider is configured yet. Ask the owner to connect one.');
          }
          return ctx.reply('The AI request failed. Please try again later.');
        }
      },
    },
    {
      name: 'history',
      aliases: ['aihistory'],
      category: 'ai',
      role: 'sudo',
      usage: '.history',
      description: 'Show your current AI session history (owner/trusted).',
      async execute(ctx) {
        const history = sessions.history(ctx.senderJid, ctx.chatJid);
        if (!history.length) return ctx.reply('No AI conversation history for this session.');
        const lines = history.map((item, index) => `${index + 1}. ${item.role}: ${item.content}`).join('\n');
        return ctx.reply(`AI history (${history.length}):\n${lines}`);
      },
    },
    {
      name: 'clear-h',
      aliases: ['clearhistory'],
      category: 'ai',
      usage: '.clear-h [all]',
      async execute(ctx) {
        if (ctx.args?.[0] === 'all') {
          if (!hasOwnerRole(ctx.role)) return ctx.reply('Owner only.');
          const count = sessions.clearAll();
          return ctx.reply(`Cleared ${count} AI sessions.`);
        }
        sessions.clear(ctx.senderJid, ctx.chatJid);
        return ctx.reply('Your AI conversation history has been cleared.');
      },
    },
    {
      name: 'train',
      aliases: ['learn'],
      category: 'ai',
      role: 'owner',
      usage: '.train <information>',
      description: 'Teach NOVA_VOID persistent knowledge.',
      async execute(ctx) {
        if (!ctx.argsText) return ctx.reply('Usage: .train <information>');
        memory.add(ctx.senderJid, ctx.argsText);
        return ctx.reply('Learned and stored in NOVA_VOID memory.');
      },
    },
    {
      name: 'train-list',
      aliases: ['memory'],
      category: 'ai',
      role: 'owner',
      description: 'List stored training memory.',
      async execute(ctx) {
        const records = memory.list(ctx.senderJid);
        if (!records.length) return ctx.reply('NOVA_VOID has no stored training memory yet.');
        return ctx.reply(records.map((item, index) => `${index + 1}. ${item.content}`).join('\n'));
      },
    },
    {
      name: 'train-remove',
      category: 'ai',
      role: 'owner',
      usage: '.train-remove <number>',
      description: 'Remove a training memory entry by number.',
      async execute(ctx) {
        const index = Number(ctx.args?.[0]);
        const records = memory.list(ctx.senderJid);
        if (!Number.isInteger(index) || index < 1 || index > records.length) return ctx.reply('Usage: .train-remove <number>');
        memory.remove(ctx.senderJid, records[index - 1].id);
        return ctx.reply('Training memory removed.');
      },
    },
  ];
}

function hasOwnerRole(role) {
  return role === 'owner';
}
