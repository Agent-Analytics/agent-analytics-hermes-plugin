import test from 'node:test';
import assert from 'node:assert/strict';

import { derivePluginView, normalizeProjects } from '../../src/dashboard/view-model.mjs';

test('derivePluginView returns login when user is not connected', () => {
  assert.equal(
    derivePluginView({ auth: { connected: false, pendingAuthRequest: null }, selectedProject: null }),
    'login'
  );
});

test('derivePluginView returns pending while browser approval is in progress', () => {
  assert.equal(
    derivePluginView({ auth: { connected: false, pendingAuthRequest: { authRequestId: 'req_1' } }, selectedProject: null }),
    'pending'
  );
});

test('derivePluginView returns project-selection when connected without project', () => {
  assert.equal(
    derivePluginView({ auth: { connected: true, pendingAuthRequest: null }, selectedProject: null }),
    'project-selection'
  );
});

test('derivePluginView returns ready when connected and a project is selected', () => {
  assert.equal(
    derivePluginView({ auth: { connected: true, pendingAuthRequest: null }, selectedProject: { name: 'docs' } }),
    'ready'
  );
});

test('normalizeProjects keeps stable project labels and allowed origins', () => {
  assert.deepEqual(normalizeProjects([
    { id: 'proj_1', name: 'docs', allowed_origins: ['https://docs.agentanalytics.sh'] },
    { id: 'proj_2', name: 'site', allowed_origins: '*' }
  ]), [
    { id: 'proj_1', name: 'docs', label: 'docs', allowedOrigins: ['https://docs.agentanalytics.sh'] },
    { id: 'proj_2', name: 'site', label: 'site', allowedOrigins: ['*'] }
  ]);
});
