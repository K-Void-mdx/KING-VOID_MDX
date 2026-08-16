export function createGenerateCommand({ generation }) {
  return {
    name: 'generate',
    aliases: ['gen'],
    category: 'ai',
    async execute(ctx) {
      if (!ctx.argsText) return ctx.reply('Usage: .generate <image prompt>');
      try {
        const result = await generation.image(ctx.argsText);
        if (result?.buffer) return ctx.sendMedia?.({ type: 'image', buffer: result.buffer, caption: result.caption ?? '' });
        if (result?.url) return ctx.reply(result.url);
        return ctx.reply('Image generation provider returned no usable media.');
      } catch (error) {
        return ctx.reply(`Image generation is not configured yet: ${error.message}`);
      }
    },
  };
}
