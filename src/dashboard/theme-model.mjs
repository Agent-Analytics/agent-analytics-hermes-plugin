export const HERMES_THEME_TOKENS = {
  shellBg: '#041c1c',
  panelBg: '#0f2a2a',
  panelBorder: '#2a4a48',
  panelText: '#d7dfdc',
  panelTextMuted: '#9eb2ad',
  panelHeading: '#f5f6f5',
  kicker: '#0f9f5b',
  link: '#0f9f5b',
  metricVisitors: '#2bb8a7',
  metricEvents: '#8bc48d',
  metricSessions: '#1fa27f',
  metricToday: '#a5d6a7',
};

function readVar(style, name) {
  if (!style || !name) return '';
  const value = style.getPropertyValue(name);
  return typeof value === 'string' ? value.trim() : '';
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function resolveHermesThemeTokens(doc = globalThis.document) {
  if (!doc || !doc.documentElement || typeof globalThis.getComputedStyle !== 'function') {
    return { ...HERMES_THEME_TOKENS };
  }

  const rootStyle = globalThis.getComputedStyle(doc.documentElement);
  const bodyStyle = doc.body ? globalThis.getComputedStyle(doc.body) : rootStyle;

  const accent = firstNonEmpty(readVar(rootStyle, '--accent'), HERMES_THEME_TOKENS.kicker);
  const border = firstNonEmpty(readVar(rootStyle, '--border'), HERMES_THEME_TOKENS.panelBorder);
  const shellBg = firstNonEmpty(bodyStyle.backgroundColor, readVar(rootStyle, '--background'), HERMES_THEME_TOKENS.shellBg);
  const text = firstNonEmpty(bodyStyle.color, HERMES_THEME_TOKENS.panelText);

  return {
    shellBg,
    panelBg: `color-mix(in srgb, ${shellBg} 84%, ${text} 16%)`,
    panelBorder: border,
    panelText: text,
    panelTextMuted: `color-mix(in srgb, ${text} 68%, transparent)`,
    panelHeading: text,
    kicker: accent,
    link: accent,
    metricVisitors: `color-mix(in srgb, ${accent} 74%, ${text} 26%)`,
    metricEvents: `color-mix(in srgb, ${accent} 70%, #f59e0b 30%)`,
    metricSessions: `color-mix(in srgb, ${accent} 86%, ${text} 14%)`,
    metricToday: `color-mix(in srgb, ${accent} 70%, #facc15 30%)`,
  };
}

export const heroBranding = {
  logoFile: 'agent-analytics-wordmark-white-transparent.png',
  iconFile: 'agent-analytics-icon-transparent.png',
  wordmark: 'Agent Analytics',
  eyebrow: 'Hermes dashboard plugin',
};
