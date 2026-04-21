const PLUGIN_SURFACE = 'hermes_plugin';
const PLUGIN_PREFIX = 'hermes_plugin_';

function getTracker() {
  if (typeof window === 'undefined') return null;
  return typeof window.aa?.track === 'function' ? window.aa.track : null;
}

export function withHermesPluginPrefix(value) {
  const stringValue = String(value || '').trim();
  if (!stringValue) return '';
  return stringValue.startsWith(PLUGIN_PREFIX) ? stringValue : `${PLUGIN_PREFIX}${stringValue}`;
}

function track(event, properties = {}) {
  const tracker = getTracker();
  if (!tracker) return;
  tracker(event, {
    surface: PLUGIN_SURFACE,
    ...properties,
  });
}

export function trackHermesPluginImpression(id, properties = {}) {
  track('hermes_plugin_impression', {
    id: withHermesPluginPrefix(id),
    ...properties,
  });
}

export function trackHermesPluginFeature(feature, properties = {}) {
  track('hermes_plugin_feature_used', {
    feature: withHermesPluginPrefix(feature),
    ...properties,
  });
}

export function trackHermesPluginCta(id, properties = {}) {
  track('hermes_plugin_cta_click', {
    id: withHermesPluginPrefix(id),
    ...properties,
  });
}
