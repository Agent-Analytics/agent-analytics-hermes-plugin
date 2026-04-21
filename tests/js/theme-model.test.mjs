import test from 'node:test';
import assert from 'node:assert/strict';

import { HERMES_THEME_TOKENS, heroBranding } from '../../src/dashboard/theme-model.mjs';

test('theme model exposes Hermes-matching shell and parchment colors', () => {
  assert.equal(HERMES_THEME_TOKENS.shellBg, '#032F2F');
  assert.equal(HERMES_THEME_TOKENS.panelBg, '#F3F1EA');
  assert.equal(HERMES_THEME_TOKENS.panelBorder, '#D9D3C5');
  assert.equal(HERMES_THEME_TOKENS.kicker, '#0F9F5B');
  assert.equal(HERMES_THEME_TOKENS.link, '#1E5D46');
});

test('heroBranding points to the bundled Agent Analytics logo asset', () => {
  assert.equal(heroBranding.wordmark, 'Agent Analytics');
  assert.equal(heroBranding.logoFile, 'agent-analytics-logo-primary-transparent.png');
  assert.match(heroBranding.eyebrow, /dashboard plugin/i);
});
