export function createAICommands({ ai, sessions, memory, permissions }) {
  return [
    {
      name: 'ai',
      aliases: ['ask'],
      category: 'ai',
      async execute(ctx) {
        if (!ctx.argsText) return ctx.reply('Usage: .ai <question>');
        try {
          return ctx.reply(await ai.chat({ userJid: ctx.senderJid, prompt: ctx.argsText, scope: ctx.chatJid }));
        } catch {
          return ctx.reply('No AI provider is configured yet.');
        }
      },
    },
    {
      name: 'history',
      aliases: ['aihistory'],
      category: 'ai',
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
      async execute(ctx) {
        if (ctx.args?.[0] === 'all') {
          if (!permissions.isOwner(ctx.senderJid)) return ctx.reply('Owner only.');
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
      async execute(ctx) {
        if (!permissions.isOwner(ctx.senderJid)) return ctx.reply('Owner only.');
        if (!ctx.argsText) return ctx.reply('Usage: .train <information>');
        memory.add(ctx.senderJid, ctx.argsText);
        return ctx.reply('Learned and stored in NOVA_VOID memory.');
      },
    },
    {
      name: 'train-list',
      aliases: ['memory'],
      category: 'ai',
      async execute(ctx) {
        if (!permissions.isOwner(ctx.senderJid)) return ctx.reply('Owner only.');
        const records = memory.list(ctx.senderJid);
        if (!records.length) return ctx.reply('NOVA_VOID has no stored training memory yet.');
        return ctx.reply(records.map((item, index) => `${index + 1}. ${item.content}`).join('\n'));
      },
    },
    {
      name: 'train-remove',
      category: 'ai',
      async execute(ctx) {
        if (!permissions.isOwner(ctx.senderJid)) return ctx.reply('Owner only.');
        const index = Number(ctx.args?.[0]);
        const records = memory.list(ctx.senderJid);
        if (!Number.isInteger(index) || index < 1 || index > records.length) return ctx.reply('Usage: .train-remove <number>');
        memory.remove(ctx.senderJid, records[index - 1].id);
        return ctx.reply('Training memory removed.');
      },
    },
  ];
}
