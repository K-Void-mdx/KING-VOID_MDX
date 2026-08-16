const commands = new Map();
const aliases = new Map();

export function registerCommand(command) {
  if (!command || typeof command.name !== 'string') throw new TypeError('Command requires a name');
  const name = command.name.trim().toLowerCase();
  if (!name || !/^[-a-z0-9_]+$/i.test(name)) throw new Error(`Invalid command name: ${command.name}`);
  if (commands.has(name)) throw new Error(`Duplicate command: ${name}`);
  if (typeof command.execute !== 'function') throw new TypeError(`Command ${name} requires execute()`);

  const normalized = Object.freeze({ aliases: [], category: 'misc', ...command, name });
  commands.set(name, normalized);

  for (const alias of normalized.aliases) {
    const key = String(alias).trim().toLowerCase();
    if (!key || commands.has(key) || aliases.has(key)) throw new Error(`Duplicate alias: ${key}`);
    aliases.set(key, name);
  }
  return normalized;
}

export function getCommand(name) {
  const key = String(name ?? '').trim().toLowerCase();
  return commands.get(key) ?? commands.get(aliases.get(key));
}

export function listCommands() {
  return [...commands.values()];
}

export function clearCommands() {
  commands.clear();
  aliases.clear();
}
