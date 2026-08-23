import { listCommands } from '../core/commands/registry.js';

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
        return ctx.reply(`*${botName}* is alive.\nUptime: ${uptime}`);
      },
    },
    {
      name: 'status',
      category: 'core',
      role: 'sudo',
      description: 'Bot runtime status (owner/trusted).',
      async execute(ctx) {
        const lines = [
          `*${botName} — STATUS*`,
          `Uptime: ${formatUptime(process.uptime())}`,
          `Chatbot chats: ${app.chatbot.list().length}`,
          `AI sessions in memory: ${app.sessions.size()}`,
          `Node: ${process.version}`,
          `Memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB RSS`,
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
        const sections = [`*${botName} — MENU*`];
        for (const [category, items] of [...byCategory.entries()].sort()) {
          sections.push(`\n*${category.toUpperCase()}*`);
          for (const item of items) {
            const usage = item.usage ? ` — ${item.usage}` : '';
            sections.push(`• ${prefix}${item.name}${usage}`);
          }
        }
        sections.push(`\nTotal: ${commands.length} commands`);
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
