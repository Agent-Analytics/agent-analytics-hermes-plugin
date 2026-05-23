import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const css = readFileSync(new URL('../../src/dashboard/style.css', import.meta.url), 'utf8');

function blockFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} block should exist`);
  return match[1];
}

test('plugin scopes compact dashboard typography from Hermes base font', () => {
  const block = blockFor('.aa-hermes-plugin');
  assert.match(block, /--aa-font-xs:\s*0\.75rem;/);
  assert.match(block, /--aa-font-sm:\s*0\.875rem;/);
  assert.match(block, /--aa-font-md:\s*1rem;/);
  assert.match(block, /font-size:\s*var\(--aa-font-sm\);/);
  assert.match(block, /line-height:\s*1\.35;/);
});

test('primary metric numbers stay compact instead of inheriting oversized host defaults', () => {
  const block = blockFor('.aa-hermes-kpi strong');
  assert.match(block, /font-size:\s*var\(--aa-font-md\);/);
  assert.match(block, /line-height:\s*1\.2;/);
});

test('plugin action buttons use compact typography instead of host button scale', () => {
  const block = blockFor('.aa-hermes-button');
  assert.match(block, /min-height:\s*1\.9rem;/);
  assert.match(block, /font-size:\s*var\(--aa-font-xs\);/);
});
