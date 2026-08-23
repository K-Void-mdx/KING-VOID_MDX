const NOT_CONFIGURED = /no .*provider is configured/i;

export function createGenerateCommand({ generation }) {
  return {
    name: 'generate',
    aliases: ['gen'],
    category: 'ai',
    usage: '.generate <image prompt>',
    description: 'Generate an image when a provider is configured.',
    async execute(ctx) {
      if (!ctx.argsText) return ctx.reply('Usage: .generate <image prompt>');
      try {
        const result = await generation.image(ctx.argsText);
        if (result?.buffer && ctx.sendMedia) {
          return ctx.sendMedia({ type: 'image', buffer: result.buffer, caption: result.caption ?? '' });
        }
        if (result?.url) return ctx.reply(result.url);
        return ctx.reply('Image generation provider returned no usable media.');
      } catch (error) {
        if (NOT_CONFIGURED.test(error?.message ?? '')) {
          return ctx.reply('Image generation is not configured yet. Ask the owner to connect a provider.');
        }
        return ctx.reply('Image generation failed. Please try again later.');
      }
    },
  };
}
