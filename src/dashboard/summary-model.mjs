function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('en-US').format(Number(value));
}

const PAID_ONLY_SECTIONS = {
  project: 'Project details require a paid Agent Analytics plan.',
  usage: 'Usage details require a paid Agent Analytics plan.',
  stats: 'Visitor, event, and session metrics require a paid Agent Analytics plan.',
  pages: 'Top Pages require a paid Agent Analytics plan.',
  events: 'Top Events require a paid Agent Analytics plan.',
  insights: 'Period insights require a paid Agent Analytics plan.'
};

export function getPaidOnlyNotice(section, unavailableSections = {}) {
  const failure = unavailableSections?.[section];
  if (failure?.status !== 403 || failure?.code !== 'PRO_REQUIRED') return null;
  const text = PAID_ONLY_SECTIONS[section];
  if (!text) return null;
  return {
    text,
    href: 'https://app.agentanalytics.sh/account/billing'
  };
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

export function summarizeTimeframe(summary = {}, now = new Date()) {
  const daysRaw = Number(summary?.days || 7);
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.floor(daysRaw) : 7;
  const end = new Date(now);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - days);
  return {
    label: `Last ${days} days`,
    range: `${formatShortDate(start)} – ${formatShortDate(end)}`,
  };
}

export function summarizeProjectHeader(summary = {}) {
  const projectName = summary?.project?.project?.name || summary?.selectedProject?.name || 'Selected project';
  const originsRaw = summary?.selectedProject?.allowedOrigins;
  const origins = Array.isArray(originsRaw)
    ? originsRaw
    : (typeof originsRaw === 'string' && originsRaw.trim() ? [originsRaw.trim()] : []);
  return {
    name: projectName,
    originsLabel: origins.length ? origins.join(', ') : 'No allowed origins saved'
  };
}

export function buildKpiCards(summary = {}) {
  const totals = summary?.stats?.totals || {};
  const sessions = summary?.stats?.sessions || {};
  const usageToday = summary?.project?.usage_today || {};
  const totalSessions = sessions.totalSessions ?? sessions.total_sessions ?? null;
  return [
    { label: 'Visitors', value: formatNumber(totals.unique_users) },
    { label: 'Events', value: formatNumber(totals.total_events) },
    { label: 'Sessions', value: formatNumber(totalSessions) },
    { label: 'Today', value: `${formatNumber(usageToday.event_count)} events · ${formatNumber(usageToday.read_count)} reads` }
  ];
}
