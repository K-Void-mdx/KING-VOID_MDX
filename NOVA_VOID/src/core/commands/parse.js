export function parseCommand(text = '', prefixes = ['.']) {
  const input = String(text).trim();
  const prefix = prefixes.find((item) => input.startsWith(item));
  if (!prefix) return null;

  const body = input.slice(prefix.length).trim();
  if (!body) return null;
  const [name, ...args] = body.split(/\s+/);

  return {
    prefix,
    name: name.toLowerCase(),
    args,
    text: args.join(' '),
  };
}
