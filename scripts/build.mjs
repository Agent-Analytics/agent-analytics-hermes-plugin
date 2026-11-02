import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(root, 'dashboard', 'dist');
const logoSrc = resolve(root, '..', 'agent-analytics-logo-pack', 'agent-analytics-wordmark-white-transparent.png');
const iconSrc = resolve(root, '..', 'agent-analytics-logo-pack', 'agent-analytics-icon-transparent.png');
const sidebarIconSrc = resolve(root, 'src', 'dashboard', 'assets', 'agent-analytics-icon-sidebar.png');

async function copyAssetOrKeepExisting(sourcePath, destinationPath) {
  try {
    await copyFile(sourcePath, destinationPath);
  } catch (error) {
    if (error.code !== 'ENOENT' || !existsSync(destinationPath)) throw error;
  }
}

await mkdir(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [resolve(root, 'src', 'dashboard', 'index.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  outfile: resolve(outDir, 'index.js'),
  logLevel: 'info',
});

const sharedUiVars = await readFile(resolve(root, 'node_modules', '@agent-analytics', 'shared-ui', 'dist', 'variables.css'), 'utf8');
const pluginCss = await readFile(resolve(root, 'src', 'dashboard', 'style.css'), 'utf8');
await writeFile(resolve(outDir, 'style.css'), `${sharedUiVars}\n\n${pluginCss}`);
await copyAssetOrKeepExisting(logoSrc, resolve(outDir, 'agent-analytics-wordmark-white-transparent.png'));
await copyAssetOrKeepExisting(iconSrc, resolve(outDir, 'agent-analytics-icon-transparent.png'));
await copyFile(sidebarIconSrc, resolve(outDir, 'agent-analytics-icon-sidebar.png'));
