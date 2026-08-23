import * as wa from '../ui/wa-style.js';

const NOT_CONFIGURED = /no .*provider is configured/i;

export function createGenerateCommand({ generation }) {
  return {
    name: 'generate',
    aliases: ['gen'],
    category: 'ai',
    usage: '.generate <image prompt>',
    description: 'Generate an image when a provider is configured.',
    async execute(ctx) {
      if (!ctx.argsText) {
        return ctx.reply(['⚠️ *_USAGE_*', '', '`.generate <image prompt>`', '', wa.footer()].join('\n'));
      }
      try {
        const result = await generation.image(ctx.argsText);
        if (result?.buffer && ctx.sendMedia) {
          return ctx.sendMedia({ type: 'image', buffer: result.buffer, caption: result.caption ?? '' });
        }
        if (result?.url) return ctx.reply(result.url);
        return ctx.reply(
          [wa.header(), '', '⚠️ *_GENERATION INCOMPLETE_*', '', 'Provider returned no usable media.', '', wa.footer()].join('\n')
        );
      } catch (error) {
        if (NOT_CONFIGURED.test(error?.message ?? '')) {
          return ctx.reply(
            [
              wa.header(),
              '',
              '🧠 *_IMAGE AI NOT CONFIGURED_*',
              '',
              'No image generation provider is connected yet.',
              '',
              wa.row('Status', 'UNAVAILABLE'),
              '',
              wa.footer(),
            ].join('\n')
          );
        }
        console.error(`[GENERATE] provider error: ${error?.message ?? error}`);
        return ctx.reply(
          [wa.header(), '', '🔴 *_GENERATION FAILED_*', '', 'Please try again in a moment.', '', wa.footer()].join('\n')
        );
      }
    },
  };
}
