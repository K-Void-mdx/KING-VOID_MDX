export function createChatbotCommand({ state, permissions }) {
  return {
    name: 'chatbot',
    category: 'ai',
    usage: '.chatbot on|off',
    async execute(ctx) {
      if (!permissions.isOwner(ctx.senderJid)) return ctx.reply('Owner only.');
      const mode = String(ctx.args?.[0] ?? '').toLowerCase();
      if (!['on', 'off'].includes(mode)) return ctx.reply('Usage: .chatbot on|off');
      state.set(ctx.chatJid, mode === 'on');
      return ctx.reply(`NOVA_VOID chatbot is now ${mode.toUpperCase()}.\nIt responds only to direct mentions and replies to the bot.`);
    },
  };
}
