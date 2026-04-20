export function shouldShowAccountCard(view, auth = {}) {
  return Boolean(auth.connected) && (view === 'project-selection' || view === 'ready');
}

export function primaryActionsForView(view) {
  if (view === 'pending') return ['refresh-status', 'start-over'];
  if (view === 'login') return ['log-in', 'docs'];
  if (view === 'project-selection') return ['project-select'];
  if (view === 'ready') return ['refresh-data'];
  return [];
}
