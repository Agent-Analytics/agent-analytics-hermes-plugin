import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifestPath = new URL('../../dashboard/manifest.json', import.meta.url);

test('manifest label avoids analytics-vs-agent-analytics ambiguity', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.name, 'agent-analytics');
  assert.equal(manifest.label, 'Signals');
  assert.equal(manifest.tab.path, '/agent-analytics');
});
