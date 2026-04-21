import { buildKpiCards, summarizeProjectHeader, summarizeTimeframe } from './summary-model.mjs';
import { HERMES_THEME_TOKENS, heroBranding, resolveHermesThemeTokens } from './theme-model.mjs';
import { derivePluginView } from './view-model.mjs';

(function () {
  const SDK = window.__HERMES_PLUGIN_SDK__;
  const { React } = SDK;
  const { useEffect, useState } = SDK.hooks;
  const { Card, CardHeader, CardTitle, CardContent, Button, Badge } = SDK.components;

  const STATUS_URL = '/api/plugins/agent-analytics/status';
  const SUMMARY_URL = '/api/plugins/agent-analytics/summary';
  const AUTH_START_URL = '/api/plugins/agent-analytics/auth/start';
  const AUTH_POLL_URL = '/api/plugins/agent-analytics/auth/poll';
  const AUTH_DISCONNECT_URL = '/api/plugins/agent-analytics/auth/disconnect';
  const HERMES_SKILL_DOCS_URL = 'https://docs.agentanalytics.sh/installation/hermes/';
  const LOGO_SRC = `/dashboard-plugins/agent-analytics/dist/${heroBranding.logoFile}`;
  const ICON_SRC = `/dashboard-plugins/agent-analytics/dist/${heroBranding.iconFile}`;

  function postJSON(url, body) {
    return SDK.fetchJSON(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  }

  function BrandLockup() {
    return React.createElement('div', { className: 'aa-hermes-brand-lockup' },
      React.createElement('img', {
        alt: `${heroBranding.wordmark} icon`,
        className: 'aa-hermes-brand-icon',
        src: ICON_SRC,
      }),
      React.createElement('img', {
        alt: heroBranding.wordmark,
        className: 'aa-hermes-brand-image aa-hermes-brand-image-wordmark',
        src: LOGO_SRC,
      })
    );
  }

  function EmptyState({ children, kicker, title, actions }) {
    return React.createElement(Card, { className: 'aa-hermes-card aa-hermes-empty' },
      React.createElement(CardHeader, { className: 'aa-hermes-header-row aa-hermes-header-row-top' },
        React.createElement('div', { className: 'aa-hermes-stack aa-hermes-stack-tight' },
          React.createElement('p', { className: 'aa-hermes-kicker' }, kicker),
          React.createElement(CardTitle, { className: 'aa-hermes-title' }, title)
        ),
        React.createElement(BrandLockup, null)
      ),
      React.createElement(CardContent, { className: 'aa-hermes-stack' },
        children,
        actions ? React.createElement('div', { className: 'aa-hermes-actions' }, actions) : null,
      ),
    );
  }

  function SummaryView({ summary, onRefresh, accountEmail, accountTier, onDisconnect }) {
    const timeframe = summarizeTimeframe(summary);
    const projectSummaries = Array.isArray(summary.projects) ? summary.projects : [];

    return React.createElement('div', { className: 'aa-hermes-stack aa-hermes-plugin' },
      React.createElement(Card, { className: 'aa-hermes-card aa-hermes-card-hero' },
        React.createElement(CardHeader, { className: 'aa-hermes-header-row' },
          React.createElement('div', { className: 'aa-hermes-stack' },
            React.createElement(BrandLockup, null),
            React.createElement('div', { className: 'aa-hermes-stack aa-hermes-stack-tight' },
              React.createElement('div', { className: 'aa-hermes-timeframe' },
                React.createElement('span', { className: 'aa-hermes-timeframe-label' }, timeframe.label),
                React.createElement('span', { className: 'aa-hermes-timeframe-range' }, timeframe.range)
              )
            )
          ),
          React.createElement('div', { className: 'aa-hermes-account-row aa-hermes-account-row-hero' },
            React.createElement('span', { className: 'aa-hermes-muted aa-hermes-account-email' }, accountEmail || 'Connected'),
            React.createElement(Badge, { variant: 'outline', className: 'aa-hermes-badge' }, accountTier || 'connected'),
            React.createElement(Button, { className: 'aa-hermes-button aa-hermes-button-light', onClick: onDisconnect }, 'Disconnect'),
            React.createElement(Button, { className: 'aa-hermes-button aa-hermes-button-light', onClick: onRefresh }, 'Refresh')
          )
        )
      ),
      projectSummaries.length
        ? React.createElement('div', { className: 'aa-hermes-grid aa-hermes-grid-projects' },
            projectSummaries.map((projectSummary, index) => {
              const header = summarizeProjectHeader(projectSummary);
              const kpis = buildKpiCards(projectSummary);
              const topEvents = ((projectSummary.stats || {}).events || []).slice(0, 4);
              const topPages = ((projectSummary.pages || {}).rows || (projectSummary.pages || {}).pages || []).slice(0, 4);

              return React.createElement(Card, { className: 'aa-hermes-card', key: `${header.name}-${index}` },
                React.createElement(CardHeader, { className: 'aa-hermes-stack aa-hermes-stack-tight' },
                  React.createElement(CardTitle, { className: 'aa-hermes-subtitle' }, header.name),
                  React.createElement('span', { className: 'aa-hermes-muted' }, header.originsLabel)
                ),
                React.createElement(CardContent, { className: 'aa-hermes-stack' },
                  React.createElement('div', { className: 'aa-hermes-grid aa-hermes-grid-kpis' },
                    kpis.map((card) => {
                      const metricClass = `aa-hermes-kpi aa-hermes-kpi-${String(card.label || '').toLowerCase()}`;
                      return React.createElement('div', { className: metricClass, key: `${header.name}-${card.label}` },
                        React.createElement('span', { className: 'aa-hermes-label' }, card.label),
                        React.createElement('strong', null, card.value)
                      );
                    })
                  ),
                  React.createElement('div', { className: 'aa-hermes-grid aa-hermes-grid-panels' },
                    React.createElement(Card, { className: 'aa-hermes-card' },
                      React.createElement(CardHeader, null, React.createElement(CardTitle, { className: 'aa-hermes-subtitle' }, 'Top Pages')),
                      React.createElement(CardContent, { className: 'aa-hermes-stack aa-hermes-stack-tight' },
                        topPages.length
                          ? topPages.map((row, rowIndex) => React.createElement('div', { className: 'aa-hermes-list-row', key: `${row.path || row.page || 'page'}-${rowIndex}` },
                              React.createElement('span', null, row.path || row.page || '(unknown)'),
                              React.createElement('strong', null, String(row.visitors || row.count || 0))
                            ))
                          : React.createElement('p', { className: 'aa-hermes-muted' }, 'No page data yet.')
                      )
                    ),
                    React.createElement(Card, { className: 'aa-hermes-card' },
                      React.createElement(CardHeader, null, React.createElement(CardTitle, { className: 'aa-hermes-subtitle' }, 'Top Events')),
                      React.createElement(CardContent, { className: 'aa-hermes-stack aa-hermes-stack-tight' },
                        topEvents.length
                          ? topEvents.map((row, rowIndex) => React.createElement('div', { className: 'aa-hermes-list-row', key: `${row.event || 'event'}-${rowIndex}` },
                              React.createElement('span', null, row.event || '(unknown)'),
                              React.createElement('strong', null, String(row.count || 0))
                            ))
                          : React.createElement('p', { className: 'aa-hermes-muted' }, 'No event data yet.')
                      )
                    )
                  )
                )
              );
            })
          )
        : React.createElement(Card, { className: 'aa-hermes-card' },
            React.createElement(CardContent, { className: 'aa-hermes-stack' },
              React.createElement('p', { className: 'aa-hermes-muted' }, 'No projects found for this account.')
            )
          )
    );
  }

  function AgentAnalyticsPage() {
    const [status, setStatus] = useState(null);
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [loadingSummary, setLoadingSummary] = useState(false);

    const view = derivePluginView(status || {});

    useEffect(function () {
      const tokens = resolveHermesThemeTokens(document);
      document.documentElement.style.setProperty('--aa-hermes-shell-bg', tokens.shellBg || HERMES_THEME_TOKENS.shellBg);
      document.documentElement.style.setProperty('--aa-hermes-panel-bg', tokens.panelBg || HERMES_THEME_TOKENS.panelBg);
      document.documentElement.style.setProperty('--aa-hermes-panel-border', tokens.panelBorder || HERMES_THEME_TOKENS.panelBorder);
      document.documentElement.style.setProperty('--aa-hermes-panel-text', tokens.panelText || HERMES_THEME_TOKENS.panelText);
      document.documentElement.style.setProperty('--aa-hermes-panel-text-muted', tokens.panelTextMuted || HERMES_THEME_TOKENS.panelTextMuted);
      document.documentElement.style.setProperty('--aa-hermes-panel-heading', tokens.panelHeading || HERMES_THEME_TOKENS.panelHeading);
      document.documentElement.style.setProperty('--aa-hermes-kicker', tokens.kicker || HERMES_THEME_TOKENS.kicker);
      document.documentElement.style.setProperty('--aa-hermes-link', tokens.link || HERMES_THEME_TOKENS.link);
      document.documentElement.style.setProperty('--aa-hermes-metric-visitors', tokens.metricVisitors || HERMES_THEME_TOKENS.metricVisitors);
      document.documentElement.style.setProperty('--aa-hermes-metric-events', tokens.metricEvents || HERMES_THEME_TOKENS.metricEvents);
      document.documentElement.style.setProperty('--aa-hermes-metric-sessions', tokens.metricSessions || HERMES_THEME_TOKENS.metricSessions);
      document.documentElement.style.setProperty('--aa-hermes-metric-today', tokens.metricToday || HERMES_THEME_TOKENS.metricToday);
      return function cleanup() {
        document.documentElement.style.removeProperty('--aa-hermes-shell-bg');
        document.documentElement.style.removeProperty('--aa-hermes-panel-bg');
        document.documentElement.style.removeProperty('--aa-hermes-panel-border');
        document.documentElement.style.removeProperty('--aa-hermes-panel-text');
        document.documentElement.style.removeProperty('--aa-hermes-panel-text-muted');
        document.documentElement.style.removeProperty('--aa-hermes-panel-heading');
        document.documentElement.style.removeProperty('--aa-hermes-kicker');
        document.documentElement.style.removeProperty('--aa-hermes-link');
        document.documentElement.style.removeProperty('--aa-hermes-metric-visitors');
        document.documentElement.style.removeProperty('--aa-hermes-metric-events');
        document.documentElement.style.removeProperty('--aa-hermes-metric-sessions');
        document.documentElement.style.removeProperty('--aa-hermes-metric-today');
      };
    }, []);

    function loadStatus() {
      setLoadingStatus(true);
      setError('');
      return SDK.fetchJSON(STATUS_URL)
        .then((data) => setStatus(data))
        .catch((err) => setError(err.message || 'Failed to load Agent Analytics plugin status.'))
        .finally(() => setLoadingStatus(false));
    }

    function loadSummary() {
      setLoadingSummary(true);
      setError('');
      return SDK.fetchJSON(SUMMARY_URL)
        .then((data) => setSummary(data))
        .catch((err) => setError(err.message || 'Failed to load project summary.'))
        .finally(() => setLoadingSummary(false));
    }

    useEffect(function () {
      loadStatus();
    }, []);

    useEffect(function () {
      if (!status) return undefined;
      if (derivePluginView(status) === 'pending') {
        const interval = setInterval(function () {
          postJSON(AUTH_POLL_URL, {})
            .then((data) => setStatus(data))
            .catch(() => {});
        }, 2500);
        return function cleanup() { clearInterval(interval); };
      }
      return undefined;
    }, [status]);

    useEffect(function () {
      if (!status) return;
      if (derivePluginView(status) === 'ready') {
        loadSummary();
      } else {
        setSummary(null);
      }
    }, [status && status.auth && status.auth.connected ? 'connected' : 'signed_out']);

    function handleStartAuth() {
      setError('');
      postJSON(AUTH_START_URL, { dashboard_origin: window.location.origin })
        .then((data) => {
          setStatus(data);
          const authorizeUrl = data && data.auth && data.auth.pendingAuthRequest && data.auth.pendingAuthRequest.authorizeUrl;
          if (authorizeUrl) window.open(authorizeUrl, '_blank');
        })
        .catch((err) => setError(err.message || 'Failed to start login.'));
    }

    function handleDisconnect() {
      postJSON(AUTH_DISCONNECT_URL, {})
        .then((data) => setStatus(data))
        .catch((err) => setError(err.message || 'Failed to disconnect.'));
    }

    if (loadingStatus && !status) {
      return React.createElement('div', { className: 'aa-hermes-stack aa-hermes-plugin' },
        React.createElement(Card, { className: 'aa-hermes-card' },
          React.createElement(CardContent, { className: 'aa-hermes-stack' },
            React.createElement('p', { className: 'aa-hermes-muted' }, 'Loading account status…')
          )
        )
      );
    }

    return React.createElement('div', { className: 'aa-hermes-stack aa-hermes-plugin' },
      error ? React.createElement('div', { className: 'aa-hermes-error' }, error) : null,
      view === 'login'
        ? React.createElement(Card, { className: 'aa-hermes-card aa-hermes-empty' },
            React.createElement(CardContent, { className: 'aa-hermes-stack aa-hermes-login-shell' },
              React.createElement('div', { className: 'aa-hermes-stack aa-hermes-stack-tight aa-hermes-login-hero' },
                React.createElement(BrandLockup, null),
                React.createElement(CardTitle, { className: 'aa-hermes-title' }, 'Link your Agent Analytics workspace')
              ),
              React.createElement('p', { className: 'aa-hermes-muted aa-hermes-login-note' }, 'Secure sign-in usually takes less than a minute and returns you here automatically.'),
              React.createElement('div', { className: 'aa-hermes-path-grid' },
                React.createElement('div', { className: 'aa-hermes-path-card' },
                  React.createElement('p', { className: 'aa-hermes-label' }, 'I already have an account'),
                  React.createElement('p', { className: 'aa-hermes-muted' }, 'Sign in and connect your existing workspace.'),
                  React.createElement(Button, { className: 'aa-hermes-button', key: 'login', onClick: handleStartAuth }, 'Sign in')
                ),
                React.createElement('div', { className: 'aa-hermes-path-card' },
                  React.createElement('p', { className: 'aa-hermes-label' }, 'I am new to Agent Analytics'),
                  React.createElement('p', { className: 'aa-hermes-muted' }, 'Run setup first, then come back here to connect.'),
                  React.createElement('a', { className: 'aa-hermes-button aa-hermes-button-secondary aa-hermes-link-button', href: HERMES_SKILL_DOCS_URL, key: 'docs', target: '_blank', rel: 'noreferrer' }, 'Start setup')
                )
              )
            )
          )
        : null,
      view === 'pending'
        ? React.createElement(EmptyState, {
            kicker: 'Waiting for approval',
            title: 'Finish login in the browser',
            actions: [
              React.createElement(Button, { className: 'aa-hermes-button aa-hermes-button-light', key: 'refresh', onClick: loadStatus }, 'Refresh status'),
              React.createElement(Button, { className: 'aa-hermes-button', key: 'restart', onClick: function () { handleDisconnect(); setTimeout(handleStartAuth, 150); } }, 'Start over')
            ]
          },
            React.createElement('p', { className: 'aa-hermes-muted' }, 'This tab updates automatically while Agent Analytics waits for browser approval.'),
            status && status.auth && status.auth.pendingAuthRequest && status.auth.pendingAuthRequest.authorizeUrl
              ? React.createElement('a', { className: 'aa-hermes-doc-link', href: status.auth.pendingAuthRequest.authorizeUrl, target: '_blank', rel: 'noreferrer' }, 'Open approval page again')
              : null
          )
        : null,
      view === 'ready'
        ? (loadingSummary && !summary
            ? React.createElement(Card, { className: 'aa-hermes-card' },
                React.createElement(CardContent, { className: 'aa-hermes-stack' },
                  React.createElement('p', { className: 'aa-hermes-muted' }, 'Loading project summaries…')
                )
              )
            : React.createElement(SummaryView, {
                summary: summary || {},
                onRefresh: loadSummary,
                accountEmail: status && status.auth && status.auth.accountSummary ? status.auth.accountSummary.email : '',
                accountTier: status && status.auth ? status.auth.tier : '',
                onDisconnect: handleDisconnect,
              }))
        : null
    );
  }

  window.__HERMES_PLUGINS__.register('agent-analytics', AgentAnalyticsPage);
})();
