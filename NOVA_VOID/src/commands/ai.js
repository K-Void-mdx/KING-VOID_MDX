import { AIProviderError } from '../ai/provider.js';
import * as wa from '../ui/wa-style.js';


export function createAICommands({ ai, sessions, memory, limiter }) {
  return [
    {
      name: 'ai',
      aliases: ['ask'],
      category: 'ai',
      usage: '.ai <question>',
      async execute(ctx) {
        if (!ctx.argsText) {
          return ctx.reply(
            ['⚠️ *_USAGE_*', '', '`.ai <question>`', '', wa.footer()].join('\n')
          );
        }
        const limitKey = `cmd:ai:${ctx.senderJid}`;
        if (limiter && !limiter.allow(limitKey)) {
          const seconds = Math.ceil(limiter.msUntilAllowed(limitKey) / 1000);
          return ctx.reply(wa.rateLimited().replace('COOLDOWN', `${seconds}s`));
        }
        try {
          return ctx.reply(await ai.chat({ userJid: ctx.senderJid, prompt: ctx.argsText, scope: ctx.chatJid }));
        } catch (error) {
          // Priority chain: real provider → trained knowledge → honest card.
          // Applies to "not configured", provider crashes and exhausted
          // quotas alike — the bot never invents an answer either way.
          const known = typeof ai.answerFromKnowledge === 'function' ? ai.answerFromKnowledge(ctx.argsText) : null;
          if (known) return ctx.reply(wa.knowledgeAnswer(known.content));
          // ALWAYS log the actual error to Termux — including AIProviderError.
          console.error(`[AI] provider error: ${error?.message ?? error}`);
          if (error?.cause) console.error(`[AI] caused by: ${error.cause?.message ?? error.cause}`);
          return ctx.reply(wa.aiNotConfigured());
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
        if (!history.length) {
          return ctx.reply(
            [
              wa.header(),
              '',
              '🧠 *_AI HISTORY_*',
              '',
              'No conversation history in this session yet.',
              '',
              wa.footer(),
            ].join('\n')
          );
        }
        const lines = history.map((item, index) => `\`${index + 1}.\` *${item.role}*: ${item.content}`).join('\n');
        return ctx.reply(
          [
            wa.header(),
            '',
            '🧠 *_AI HISTORY_*',
            '',
            wa.section('SESSION'),
            wa.row('Messages', String(history.length)),
            wa.sectionEnd(),
            '',
            lines,
            '',
            wa.footer(),
          ].join('\n')
        );
      },
    },
    {
      name: 'clear-h',
      aliases: ['clearhistory'],
      category: 'ai',
      usage: '.clear-h [all]',
      async execute(ctx) {
        if (ctx.args?.[0] === 'all') {
          if (ctx.role !== 'owner') {
            return ctx.reply(wa.accessDenied('clear-h all', 'owner'));
          }
          const count = sessions.clearAll();
          return ctx.reply(
            [
              wa.header(),
              '',
              '🛠️ *_HISTORY CLEARED_*',
              '',
              wa.section('RESULT'),
              wa.row('Sessions cleared', String(count)),
              wa.sectionEnd(),
              '',
              wa.footer(),
            ].join('\n')
          );
        }
        sessions.clear(ctx.senderJid, ctx.chatJid);
        return ctx.reply(
          [wa.header(), '', '🛠️ *_HISTORY CLEARED_*', '', 'Your session history is now empty.', '', wa.footer()].join('\n')
        );
      },
    },
    {
      name: 'train',
      aliases: ['learn'],
      category: 'ai',
      role: 'owner',
      usage: '.train <information>',
      description: 'Teach NOVA_VOID knowledge every chat can use.',
      async execute(ctx) {
        if (!ctx.argsText) {
          return ctx.reply(['⚠️ *_USAGE_*', '', '`.train <information>`', '', wa.footer()].join('\n'));
        }
        memory.add('*', ctx.argsText, { scope: 'global' });
        return ctx.reply(
          [
            wa.header(),
            '',
            '🧠 *_TRAINED_*',
            '',
            'Knowledge stored in NOVA_VOID global memory.',
            '',
            wa.section('ENTRY'),
            wa.row('Scope', 'GLOBAL'),
            wa.row('Size', String(memory.listAll('global').length)),
            wa.sectionEnd(),
            '',
            wa.footer(),
          ].join('\n')
        );
      },
    },
    {
      name: 'train-list',
      aliases: ['memory'],
      category: 'ai',
      role: 'owner',
      description: 'List stored training memory.',
      async execute(ctx) {
        const records = memory.listAll('global');
        if (!records.length) {
          return ctx.reply(
            [wa.header(), '', '🧠 *_KNOWLEDGE BASE EMPTY_*', '', 'Use `.train <information>` to teach the bot.', '', wa.footer()].join('\n')
          );
        }
        const lines = records.map((item, index) => `\`${index + 1}.\` ${item.content}`).join('\n');
        return ctx.reply(
          [wa.header(), '', '🧠 *_KNOWLEDGE BASE_*', '', lines, '', wa.section('SYSTEM'), wa.row('Total', String(records.length)), wa.sectionEnd(), '', wa.footer()].join('\n')
        );
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
        const records = memory.listAll('global');
        if (!Number.isInteger(index) || index < 1 || index > records.length) {
          return ctx.reply(['⚠️ *_USAGE_*', '', '`.train-remove <number>`', '', wa.footer()].join('\n'));
        }
        memory.remove('*', records[index - 1].id, 'global');
        return ctx.reply([wa.header(), '', '🧠 *_MEMORY REMOVED_*', '', `\`#${index}\` deleted.`, '', wa.footer()].join('\n'));
      },
    },
  ];
}
