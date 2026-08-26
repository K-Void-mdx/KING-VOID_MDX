import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as wa from '../ui/wa-style.js';

const PROJECT_ROOT = join(
  import.meta.url.startsWith('file://') ? new URL(import.meta.url).pathname : process.argv[1],
  '..', '..', '..'
);

export function createUpdateCommand() {
  return {
    name: 'update',
    aliases: ['pull', 'upgrade'],
    category: 'core',
    role: 'owner',
    usage: '.update',
    description: 'Pull latest code from GitHub and restart the bot.',
    async execute(ctx) {
      await ctx.reply(
        [
          wa.header(),
          '',
          '🔄 *_CHECKING FOR UPDATES..._*',
          '',
          'Pulling latest code from GitHub...',
          '',
          wa.footer(),
        ].join('\n')
      );

      try {
        // Stash any local changes, pull, check what changed
        const result = execSync('git stash && git pull origin main 2>&1', {
          cwd: PROJECT_ROOT,
          encoding: 'utf8',
          timeout: 30_000,
        });

        const upToDate = /Already up to date/i.test(result);
        const commitMatch = result.match(/([a-f0-9]{7})\.\.([a-f0-9]{7})/);
        const filesChanged = result.match(/(\d+) files? changed/);

        if (upToDate) {
          return ctx.reply(
            [
              wa.header(),
              '',
              '✅ *_ALREADY UP TO DATE_*',
              '',
              'No new updates available.',
              '',
              wa.footer(),
            ].join('\n')
          );
        }

        // Pop stash if there were stashed changes
        try { execSync('git stash pop', { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 10_000 }); } catch { /* no stash to pop */ }

        const summary = [];
        if (commitMatch) summary.push(`Commit: \`${commitMatch[1]}\` → \`${commitMatch[2]}\``);
        if (filesChanged) summary.push(`Files changed: \`${filesChanged[1]}\``);

        await ctx.reply(
          [
            wa.header(),
            '',
            '🔄 *_UPDATE FOUND_*',
            '',
            ...summary,
            '',
            'Restarting bot in 3 seconds...',
            '',
            wa.footer(),
          ].join('\n')
        );

        // Restart after a short delay so the message is sent
        setTimeout(() => {
          console.log('[ UPDATE ] Restarting after git pull...');
          process.exit(0);
        }, 3000);

      } catch (error) {
        return ctx.reply(
          [
            wa.header(),
            '',
            '🔴 *_UPDATE FAILED_*',
            '',
            `Error: \`${error?.message ?? 'unknown'}\``,
            '',
            'Check Termux for details.',
            '',
            wa.footer(),
          ].join('\n')
        );
      }
    },
  };
}
