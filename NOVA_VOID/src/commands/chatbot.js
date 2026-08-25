import * as wa from '../ui/wa-style.js';

export function createChatbotCommand({ state }) {
  return {
    name: 'chatbot',
    category: 'ai',
    role: 'owner',
    usage: '.chatbot on|off',
    description: 'Toggle AI chatbot mode for this chat.',
    async execute(ctx) {
      const mode = String(ctx.args?.[0] ?? '').toLowerCase();
      if (!['on', 'off'].includes(mode)) {
        return ctx.reply(['⚠️ *_USAGE_*', '', '`.chatbot on|off`', '', wa.footer()].join('\n'));
      }
      state.set(ctx.chatJid, mode === 'on');
      if (mode === 'on') {
        return ctx.reply(
          [
            wa.header(),
            '',
            '🟢 *_CHATBOT ENABLED_*',
            '',
            `💬 *_${wa.BOT}_* will now respond when:`,
            '`• Mentioned`',
            '`• Replied to`',
            '`• Triggered according to chatbot rules`',
            '',
            wa.section('STATUS'),
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
          wa.row('Status', 'OFF'),
          wa.sectionEnd(),
          '',
          'Normal messages will remain silent.',
          '',
          wa.footer(),
        ].join('\n')
      );
    },
  };
}
