function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

export function summarizeProjectHeader(summary = {}) {
  const projectName = summary?.project?.project?.name || summary?.selectedProject?.name || 'Selected project';
  const origins = summary?.selectedProject?.allowedOrigins;
  return {
    name: projectName,
    originsLabel: Array.isArray(origins) && origins.length ? origins.join(', ') : 'No allowed origins saved'
  };
}

export function buildKpiCards(summary = {}) {
  const totals = summary?.stats?.totals || {};
  const sessions = summary?.stats?.sessions || {};
  const usageToday = summary?.project?.usage_today || {};
  const totalSessions = sessions.totalSessions ?? sessions.total_sessions ?? 0;
  return [
    { label: 'Visitors', value: formatNumber(totals.unique_users) },
    { label: 'Events', value: formatNumber(totals.total_events) },
    { label: 'Sessions', value: formatNumber(totalSessions) },
    { label: 'Today', value: `${formatNumber(usageToday.event_count)} events · ${formatNumber(usageToday.read_count)} reads` }
  ];
}
