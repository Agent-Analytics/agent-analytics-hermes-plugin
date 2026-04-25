import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { normalize } from 'node:path';

const manifestPath = new URL('../../dashboard/manifest.json', import.meta.url);
const dashboardRoot = new URL('../../dashboard/', import.meta.url);
const pluginYamlPath = new URL('../../plugin.yaml', import.meta.url);
const pluginInitPath = new URL('../../__init__.py', import.meta.url);

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function readSimpleYaml(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf(':');
        assert.notEqual(separator, -1, `Expected YAML key/value line: ${line}`);
        const key = line.slice(0, separator).trim();
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^['"]|['"]$/g, '');
        return [key, value];
      }),
  );
}

test('manifest label avoids analytics-vs-agent-analytics ambiguity', () => {
  const manifest = readManifest();
  assert.equal(manifest.name, 'agent-analytics');
  assert.equal(manifest.label, 'Signals');
  assert.equal(manifest.tab.path, '/agent-analytics');
});

test('manifest uses the monochrome Agent Analytics logo image for the Hermes sidebar icon', () => {
  const manifest = readManifest();
  assert.deepEqual(manifest.icon, {
    type: 'image',
    src: 'dist/agent-analytics-icon-bw-transparent.png',
    alt: 'Agent Analytics logo',
  });

  const iconAsset = new URL(manifest.icon.src, dashboardRoot);
  assert.equal(existsSync(iconAsset), true);
  assert.equal(
    normalize(iconAsset.pathname).startsWith(normalize(dashboardRoot.pathname)),
    true,
    'icon asset must stay under the dashboard directory',
  );
});

test('root plugin metadata supports hermes plugins install', () => {
  const manifest = readManifest();
  const pluginYaml = readSimpleYaml(pluginYamlPath);

  assert.equal(pluginYaml.manifest_version, '1');
  assert.equal(pluginYaml.name, manifest.name);
  assert.equal(pluginYaml.version, manifest.version);
  assert.equal(pluginYaml.kind, 'standalone');
  assert.equal(existsSync(pluginInitPath), true);
});
