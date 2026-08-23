export function createChatbotCommand({ state }) {
  return {
    name: 'chatbot',
    category: 'ai',
    role: 'owner',
    usage: '.chatbot on|off',
    description: 'Toggle AI chatbot mode for this chat.',
    async execute(ctx) {
      const mode = String(ctx.args?.[0] ?? '').toLowerCase();
      if (!['on', 'off'].includes(mode)) return ctx.reply('Usage: .chatbot on|off');
      state.set(ctx.chatJid, mode === 'on');
      return ctx.reply(
        `NOVA_VOID chatbot is now ${mode.toUpperCase()} for this chat.\n` +
        'It responds only to direct mentions and replies to the bot.'
      );
    },
  };
}
