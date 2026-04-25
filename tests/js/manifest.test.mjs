import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifestPath = new URL('../../dashboard/manifest.json', import.meta.url);

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

test('manifest label avoids analytics-vs-agent-analytics ambiguity', () => {
  const manifest = readManifest();
  assert.equal(manifest.name, 'agent-analytics');
  assert.equal(manifest.label, 'Signals');
  assert.equal(manifest.tab.path, '/agent-analytics');
});

test('manifest uses the Agent Analytics logo image for the Hermes sidebar icon', () => {
  const manifest = readManifest();
  assert.deepEqual(manifest.icon, {
    type: 'image',
    src: 'dist/agent-analytics-icon-transparent.png',
    alt: 'Agent Analytics logo',
  });
});
