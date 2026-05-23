export function shouldShowAccountCard(view, auth = {}) {
  return Boolean(auth.connected) && view === 'ready';
}

export function primaryActionsForView(view) {
  if (view === 'pending') return ['refresh-status', 'start-over'];
  if (view === 'login') return ['log-in', 'docs'];
  if (view === 'ready') return ['refresh-data'];
  return [];
}

export function authPopupFeatures() {
  return 'popup=yes,width=520,height=720,noopener,noreferrer';
}
