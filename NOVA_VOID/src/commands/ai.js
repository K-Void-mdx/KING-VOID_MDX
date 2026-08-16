export function createAICommands({ ai, sessions, memory, permissions }) {
  return [
    {
      name: 'ai',
      aliases: ['ask'],
      category: 'ai',
      async execute(ctx) {
        if (!ctx.argsText) return ctx.reply('Usage: .ai <question>');
        return ctx.reply(await ai.chat({ userJid: ctx.senderJid, prompt: ctx.argsText, scope: ctx.chatJid }));
      },
    },
    {
      name: 'history',
      aliases: ['aihistory'],
      category: 'ai',
      async execute(ctx) {
        const history = sessions.history(ctx.senderJid, ctx.chatJid);
        if (!history.length) return ctx.reply('No AI conversation history for this session.');
        return ctx.reply(`AI history: ${history.length} messages.`);
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
        if (!ctx.argsText) return ctx.reply('Usage: .train <information for NOVA_VOID to remember>');
        memory.add(ctx.senderJid, ctx.argsText);
        return ctx.reply('Learned and stored in NOVA_VOID memory.');
      },
    },
  ];
}
