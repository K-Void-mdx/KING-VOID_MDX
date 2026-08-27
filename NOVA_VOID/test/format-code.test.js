import assert from 'node:assert/strict';
import test from 'node:test';

import { formatWhatsAppCode } from '../src/ai/format-code.js';

test('removes fenced code block markers and monospaces the lines', () => {
  const input = 'Here:\n\n```python\nprint("hi")\nprint("yo")\n```\n\nDone.';
  const out = formatWhatsAppCode(input);
  assert.ok(!out.includes('```'), 'no literal triple-backtick fences remain');
  assert.ok(out.includes('`print("hi")`'), 'code lines wrapped in monospace');
  assert.ok(out.includes('`print("yo")`'), 'all code lines wrapped');
  assert.ok(out.includes('Here:'), 'leading prose preserved');
  assert.ok(out.includes('Done.'), 'trailing prose preserved');
  assert.ok(out.includes('─'), 'divider separates the block');
});

test('handles fences that open but never close (drain buffer)', () => {
  const input = '```js\ncode\nline\n';
  const out = formatWhatsAppCode(input);
  assert.ok(!out.includes('```'), 'dangling fence removed');
  assert.ok(out.includes('`code`'), 'buffer emitted');
  assert.ok(out.includes('`line`'), 'all buffer lines emitted');
});

test('leaves ordinary text untouched', () => {
  const input = 'Just a normal message with *bold* and `inline` code.';
  const out = formatWhatsAppCode(input);
  assert.ok(out.includes('Just a normal message'), 'prose preserved');
  assert.ok(out.includes('`inline`'), 'inline monospace preserved');
});

test('does not emit empty fence blocks', () => {
  const out = formatWhatsAppCode('before\n```\n\n```\nafter');
  assert.ok(out.includes('before'), 'leading prose kept');
  assert.ok(out.includes('after'), 'trailing prose kept');
});
