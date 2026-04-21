import test from 'node:test';
import assert from 'node:assert/strict';

import {
  trackHermesPluginCta,
  trackHermesPluginFeature,
  trackHermesPluginImpression,
  withHermesPluginPrefix,
} from '../../src/dashboard/telemetry.mjs';

test('withHermesPluginPrefix adds the Hermes plugin prefix once', () => {
  assert.equal(withHermesPluginPrefix('refresh_data'), 'hermes_plugin_refresh_data');
  assert.equal(withHermesPluginPrefix('hermes_plugin_refresh_data'), 'hermes_plugin_refresh_data');
  assert.equal(withHermesPluginPrefix(''), '');
});

test('Hermes plugin telemetry uses the host Agent Analytics tracker with prefixed ids', () => {
  const calls = [];
  const originalWindow = globalThis.window;

  globalThis.window = {
    aa: {
      track(event, properties) {
        calls.push({ event, properties });
      },
    },
  };

  trackHermesPluginImpression('view_ready', { connected: true });
  trackHermesPluginFeature('summary_loaded', { projectCount: 2 });
  trackHermesPluginCta('refresh_data', { view: 'ready' });

  globalThis.window = originalWindow;

  assert.deepEqual(calls, [
    {
      event: 'hermes_plugin_impression',
      properties: {
        surface: 'hermes_plugin',
        id: 'hermes_plugin_view_ready',
        connected: true,
      },
    },
    {
      event: 'hermes_plugin_feature_used',
      properties: {
        surface: 'hermes_plugin',
        feature: 'hermes_plugin_summary_loaded',
        projectCount: 2,
      },
    },
    {
      event: 'hermes_plugin_cta_click',
      properties: {
        surface: 'hermes_plugin',
        id: 'hermes_plugin_refresh_data',
        view: 'ready',
      },
    },
  ]);
});
