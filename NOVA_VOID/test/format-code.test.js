import assert from 'node:assert/strict';
import test from 'node:test';

import { formatWhatsAppCode, splitCodeBlocks, languageExt } from '../src/ai/format-code.js';

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

test('splitCodeBlocks returns explanation + code with extension from language tag', () => {
  const fence = '```';
  const res = splitCodeBlocks(`Here's a dice roller:\n\n${fence}python\nimport random\nprint("hi")\n${fence}\n\nEnjoy!`);
  assert.equal(res.hasCode, true);
  assert.equal(res.code, 'import random\nprint("hi")');
  assert.equal(res.language, 'python');
  assert.equal(res.fileName, 'code.py');
  assert.ok(res.explanation.includes('dice roller'));
  assert.ok(res.explanation.includes('Enjoy!'));
});

test('languageExt maps common tags to extensions, falls back to txt', () => {
  assert.equal(languageExt('python'), 'py');
  assert.equal(languageExt('javascript'), 'js');
  assert.equal(languageExt('bash'), 'sh');
  assert.equal(languageExt('python3'), 'txt'); // unknown tag -> txt
  assert.equal(languageExt(''), 'txt');
});

test('splitCodeBlocks returns code=null when there is no fenced block', () => {
  const res = splitCodeBlocks('Just a plain answer, no code here.');
  assert.equal(res.hasCode, undefined);
  assert.equal(res.code, null);
  assert.equal(res.fileName, null);
  assert.equal(res.explanation, 'Just a plain answer, no code here.');
});
