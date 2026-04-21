import test from 'node:test';
import assert from 'node:assert/strict';

import { HERMES_THEME_TOKENS, heroBranding, resolveHermesThemeTokens } from '../../src/dashboard/theme-model.mjs';

test('theme model exposes Hermes-safe fallback palette', () => {
  assert.equal(HERMES_THEME_TOKENS.shellBg, '#041c1c');
  assert.equal(HERMES_THEME_TOKENS.panelBg, '#0f2a2a');
  assert.equal(HERMES_THEME_TOKENS.panelBorder, '#2a4a48');
  assert.equal(HERMES_THEME_TOKENS.kicker, '#0f9f5b');
  assert.equal(HERMES_THEME_TOKENS.link, '#0f9f5b');
});

test('resolveHermesThemeTokens reads host theme values when available', () => {
  const style = {
    getPropertyValue(name) {
      if (name === '--accent') return ' #11aa66 ';
      if (name === '--border') return ' #445566 ';
      return '';
    },
    backgroundColor: 'rgb(8, 16, 20)',
    color: 'rgb(230, 240, 235)',
  };

  const originalGetComputedStyle = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => style;

  const tokens = resolveHermesThemeTokens({
    documentElement: {},
    body: {},
  });

  globalThis.getComputedStyle = originalGetComputedStyle;

  assert.equal(tokens.kicker, '#11aa66');
  assert.equal(tokens.link, '#11aa66');
  assert.equal(tokens.panelBorder, '#445566');
  assert.equal(tokens.shellBg, 'rgb(8, 16, 20)');
  assert.match(tokens.panelBg, /color-mix/);
});

test('heroBranding points to dark-surface and icon logo assets for Hermes skins', () => {
  assert.equal(heroBranding.wordmark, 'Agent Analytics');
  assert.equal(heroBranding.logoFile, 'agent-analytics-wordmark-white-transparent.png');
  assert.equal(heroBranding.iconFile, 'agent-analytics-icon-transparent.png');
  assert.match(heroBranding.eyebrow, /dashboard plugin/i);
});
