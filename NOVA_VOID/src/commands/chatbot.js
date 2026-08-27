import * as wa from '../ui/wa-style.js';

export function createChatbotCommand({ state }) {
  return {
    name: 'chatbot',
    category: 'ai',
    role: 'owner',
    usage: '.chatbot on|off',
    description: 'Toggle AI chatbot mode globally (all chats).',
    async execute(ctx) {
      const mode = String(ctx.args?.[0] ?? '').toLowerCase();
      if (!['on', 'off'].includes(mode)) {
        return ctx.reply(['⚠️ *_USAGE_*', '', '`.' + wa.smallCaps('chatbot') + ' on|off`', '', wa.footer()].join('\n'));
      }
      state.setGlobal(mode === 'on');
      if (mode === 'on') {
        return ctx.reply(
          [
            wa.header(),
            '',
            '🟢 *_CHATBOT ENABLED_*',
            '',
            `💬 *_${wa.BOT}_* will now respond in ALL chats:`,
            '`• DMs — always responds`',
            '`• Groups — responds when @mentioned or replied to`',
            '',
            wa.section('STATUS'),
            wa.row('Mode', 'GLOBAL'),
            wa.row('Status', 'ON'),
            wa.sectionEnd(),
            '',
            wa.footer(),
          ].join('\n')
        );
      }
      return ctx.reply(
        [
          wa.header(),
          '',
          '🔴 *_CHATBOT DISABLED_*',
          '',
          wa.section('STATUS'),
          wa.row('Mode', 'GLOBAL'),
          wa.row('Status', 'OFF'),
          wa.sectionEnd(),
          '',
          'Bot will stay silent in all chats.',
          '',
          wa.footer(),
        ].join('\n')
      );
    },
  };
}
