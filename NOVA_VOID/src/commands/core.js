import { listCommands } from '../core/commands/registry.js';
import * as wa from '../ui/wa-style.js';

/**
 * Tier-1 core commands: ping, status, menu.
 */
export function createCoreCommands({ app, botName = 'NOVA_VOID MDX', prefix = '.' }) {
  return [
    {
      name: 'ping',
      category: 'core',
      description: 'Check that the bot is alive.',
      async execute(ctx) {
        const uptime = formatUptime(process.uptime());
        return ctx.reply(
          [
            wa.header(botName),
            '',
            '🟢 *_SYSTEM RESPONSE_*',
            '',
            `*_${botName}_* is *_alive_*.`,
            '',
            wa.section('STATUS'),
            wa.row('Uptime', uptime),
            wa.row('Connection', 'ONLINE'),
            wa.sectionEnd(),
            '',
            '⚡ `PONG`',
          ].join('\n')
        );
      },
    },
    {
      name: 'status',
      category: 'core',
      role: 'sudo',
      usage: '.status',
      description: 'Bot runtime status (owner/trusted).',
      async execute(ctx) {
        const chatbotOn = app.chatbot.list().length > 0 ? 'ON' : 'OFF';
        const lines = [
          wa.header(botName),
          '',
          '📡 *_SYSTEM STATUS_*',
          '',
          wa.section(botName),
          wa.row('Status', 'ONLINE'),
          wa.row('Owner', 'OWNER'),
          wa.row('Prefix', prefix),
          wa.row('Commands', String(listCommands().length)),
          wa.row('Uptime', formatUptime(process.uptime())),
          wa.row('Chatbot', chatbotOn),
          wa.row('Memory', `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`),
          wa.sectionEnd(),
          '',
          wa.footer(botName),
        ];
        return ctx.reply(lines.join('\n'));
      },
    },
    {
      name: 'menu',
      aliases: ['help', 'commands'],
      category: 'core',
      description: 'List available commands by category.',
      async execute(ctx) {
        const commands = listCommands();
        const byCategory = new Map();
        for (const command of commands) {
          const category = command.category ?? 'misc';
          if (!byCategory.has(category)) byCategory.set(category, []);
          byCategory.get(category).push(command);
        }
        const icons = { ai: '🧠', core: '🛠️', misc: '🛠️' };
        const sections = [wa.header(`${botName} — MENU`), ''];
        for (const [category, items] of [...byCategory.entries()].sort()) {
          sections.push(`${icons[category] ?? '🛠️'} *_${category.toUpperCase()}_*`);
          for (const item of items) {
            const usage = item.usage ? ` ${item.usage.replace(/^\.\S*/, '')}` : '';
            sections.push(`\`${prefix}${item.name}${usage}\``);
          }
          sections.push('');
        }
        sections.push(wa.section('SYSTEM'));
        sections.push(wa.row('Total Commands', String(commands.length)));
        sections.push(wa.row('Prefix', prefix));
        sections.push(wa.sectionEnd());
        sections.push('');
        sections.push(wa.footer(botName));
        return ctx.reply(sections.join('\n'));
      },
    },
  ];
}

function formatUptime(seconds) {
  const total = Math.floor(Number(seconds) || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}
