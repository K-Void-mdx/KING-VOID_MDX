/**
 * Formats AI replies for WhatsApp rendering.
 *
 * WhatsApp does not render ``` fenced code blocks — the triple backticks appear
 * as literal text, which looks broken and hides the code (no clean "copy"
 * block, the way Meta AI shows one). This converts Markdown fenced blocks into
 * a WhatsApp-native monospace listing with a subtle divider, so the code is
 * readable and easy to select-and-copy.
 */

const DIVIDER = '─'.repeat(28);

/** Renders a single code line for WhatsApp monospace (escaped backticks). */
function monoTerm(line = '') {
  const cleaned = String(line).replace(/`/g, '');
  return cleaned.trim() ? `\`${cleaned}\`` : '';
}

/**
 * Converts fenced ```lang``` blocks into WhatsApp monospace lines separated by
 * a divider. Surrounding prose is preserved. Inline (single-tick) spans are
 * left untouched since WhatsApp already renders them as monospace.
 */
export function formatWhatsAppCode(text = '') {
  const source = String(text ?? '');
  const lines = source.split('\n');
  const out = [];
  let inFence = false;
  let buffer = [];

  const flush = () => {
    if (!buffer.length) return;
    out.push(DIVIDER);
    for (const line of buffer) out.push(monoTerm(line));
    out.push(DIVIDER);
    buffer = [];
  };

  for (const raw of lines) {
    const fenceMatch = /^\s*(?:```+|~~~+)\s*([^\s]*)\s*$/.exec(raw);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        buffer = [];
      } else {
        inFence = false;
        flush();
      }
      continue;
    }
    if (inFence) {
      buffer.push(raw);
      continue;
    }
    flush();
    out.push(raw);
  }
  if (inFence) flush();

  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

const LANGUAGE_EXT = {
  python: 'py', py: 'py',
  javascript: 'js', js: 'js', node: 'js', nodejs: 'js',
  typescript: 'ts', ts: 'ts',
  bash: 'sh', sh: 'sh', shell: 'sh', zsh: 'sh',
  html: 'html', xml: 'xml', css: 'css',
  json: 'json', yaml: 'yml', yml: 'yml', toml: 'toml', ini: 'ini',
  java: 'java', kotlin: 'kt', swift: 'swift', go: 'go', rust: 'rs',
  c: 'c', cpp: 'cpp', 'c++': 'cpp', csharp: 'cs', 'c#': 'cs',
  php: 'php', ruby: 'rb', perl: 'pl',
  sql: 'sql', graphql: 'graphql',
  text: 'txt', plaintext: 'txt',
};

/** Maps a code-fence language tag to a safe file extension ('' = txt). */
export function languageExt(tag = '') {
  const key = String(tag).trim().toLowerCase().split(/\s+/)[0];
  return LANGUAGE_EXT[key] ?? 'txt';
}

/**
 * Splits an AI answer into its non-code explanation and any fenced code
 * blocks. Returns `{ explanation, code, language, fileName }`; `code`/`fileName`
 * are null when the answer contains no fenced block.
 */
export function splitCodeBlocks(text = '') {
  const source = String(text ?? '');
  const lines = source.split('\n');
  const prose = [];
  let blocks = [];
  let inFence = false;
  let lang = '';
  let buffer = [];

  const flush = () => {
    if (!buffer.length) return;
    blocks.push({ language: lang, code: buffer.join('\n').replace(/\s+$/, '') });
    buffer = [];
  };

  for (const raw of lines) {
    const fenceMatch = /^\s*(?:```+|~~~+)\s*([^\s]*)\s*$/.exec(raw);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        lang = fenceMatch[1] ?? '';
        buffer = [];
      } else {
        inFence = false;
        flush();
      }
      continue;
    }
    if (inFence) {
      buffer.push(raw);
      continue;
    }
    prose.push(raw);
  }
  if (inFence) flush();

  const explanation = prose.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!blocks.length) return { explanation: explanation || source, code: null, language: '', fileName: null };

  const first = blocks[0];
  const ext = languageExt(first.language);
  const fileName = `code.${ext}`;
  return { explanation, code: first.code, language: first.language || ext, fileName, hasCode: true };
}
