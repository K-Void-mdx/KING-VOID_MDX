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
