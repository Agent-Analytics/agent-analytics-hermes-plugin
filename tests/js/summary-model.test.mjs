import test from 'node:test';
import assert from 'node:assert/strict';

import { buildKpiCards, summarizeProjectHeader, summarizeTimeframe } from '../../src/dashboard/summary-model.mjs';

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

test('summarizeTimeframe shows explicit last-seven-days label with date range', () => {
  assert.deepEqual(
    summarizeTimeframe({ days: 7 }, new Date('2026-04-21T12:00:00Z')),
    {
      label: 'Last 7 days',
      range: 'Apr 14 – Apr 21'
    }
  );
});
