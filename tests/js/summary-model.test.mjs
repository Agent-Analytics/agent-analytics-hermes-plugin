import test from 'node:test';
import assert from 'node:assert/strict';

import { buildKpiCards, summarizeProjectHeader } from '../../src/dashboard/summary-model.mjs';

test('summarizeProjectHeader prefers project name and selected origins', () => {
  assert.deepEqual(
    summarizeProjectHeader({
      project: { project: { name: 'docs' } },
      selectedProject: { allowedOrigins: ['https://docs.agentanalytics.sh'] }
    }),
    {
      name: 'docs',
      originsLabel: 'https://docs.agentanalytics.sh'
    }
  );
});

test('buildKpiCards reads totals from stats and project usage', () => {
  assert.deepEqual(
    buildKpiCards({
      project: { usage_today: { event_count: 12, read_count: 3 } },
      stats: {
        totals: { unique_users: 44, total_events: 108 },
        sessions: { totalSessions: 21, bounceRate: 0.25 }
      }
    }),
    [
      { label: 'Visitors', value: '44' },
      { label: 'Events', value: '108' },
      { label: 'Sessions', value: '21' },
      { label: 'Today', value: '12 events · 3 reads' }
    ]
  );
});
