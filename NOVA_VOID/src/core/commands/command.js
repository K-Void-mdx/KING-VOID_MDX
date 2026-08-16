export class CommandRegistry {
  #commands = new Map();

  register(command) {
    if (!command?.name || typeof command.execute !== 'function') {
      throw new TypeError('A command requires name and execute()');
    }

    const normalized = String(command.name).trim().toLowerCase();
    const entry = { ...command, name: normalized, aliases: [...(command.aliases ?? [])].map((alias) => String(alias).toLowerCase()) };
    this.#commands.set(normalized, entry);

    for (const alias of entry.aliases) this.#commands.set(alias, entry);
    return entry;
  }

  get(name) {
    return this.#commands.get(String(name ?? '').trim().toLowerCase()) ?? null;
  }

  has(name) {
    return Boolean(this.get(name));
  }

  list() {
    return [...new Set(this.#commands.values())];
  }

  categories() {
    return [...new Set(this.list().map((command) => command.category).filter(Boolean))].sort();
  }
}

export const commands = new CommandRegistry();
