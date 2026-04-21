import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldShowAccountCard, primaryActionsForView } from '../../src/dashboard/state-model.mjs';

test('account card only shows when auth is connected', () => {
  assert.equal(shouldShowAccountCard('login', { connected: false }), false);
  assert.equal(shouldShowAccountCard('pending', { connected: false }), false);
  assert.equal(shouldShowAccountCard('project-selection', { connected: true }), false);
  assert.equal(shouldShowAccountCard('ready', { connected: true }), true);
});

test('pending view exposes refresh and start-over actions', () => {
  assert.deepEqual(primaryActionsForView('pending'), ['refresh-status', 'start-over']);
});

test('login view exposes login and docs actions', () => {
  assert.deepEqual(primaryActionsForView('login'), ['log-in', 'docs']);
});
