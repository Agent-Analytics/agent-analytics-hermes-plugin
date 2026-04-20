import { buildKpiCards, summarizeProjectHeader } from './summary-model.mjs';
import { HERMES_THEME_TOKENS, heroBranding } from './theme-model.mjs';
import { derivePluginView, normalizeProjects } from './view-model.mjs';

(function () {
  const SDK = window.__HERMES_PLUGIN_SDK__;
  const { React } = SDK;
  const { useEffect, useMemo, useState } = SDK.hooks;
  const { Card, CardHeader, CardTitle, CardContent, Button, Badge } = SDK.components;

  const STATUS_URL = '/api/plugins/agent-analytics/status';
  const SUMMARY_URL = '/api/plugins/agent-analytics/summary';
  const AUTH_START_URL = '/api/plugins/agent-analytics/auth/start';
  const AUTH_POLL_URL = '/api/plugins/agent-analytics/auth/poll';
  const AUTH_DISCONNECT_URL = '/api/plugins/agent-analytics/auth/disconnect';
  const PROJECT_SELECT_URL = '/api/plugins/agent-analytics/project/select';
  const HERMES_SKILL_DOCS_URL = 'https://docs.agentanalytics.sh/installation/hermes/';
  const LOGO_SRC = '/dashboard-plugins/agent-analytics/dist/agent-analytics-logo-primary-transparent.png';

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
        alt: heroBranding.wordmark,
        className: 'aa-hermes-brand-image',
        src: LOGO_SRC,
      }),
      React.createElement('div', { className: 'aa-hermes-stack aa-hermes-stack-tight' },
        React.createElement('p', { className: 'aa-hermes-kicker' }, heroBranding.eyebrow),
        React.createElement('strong', { className: 'aa-hermes-brand-wordmark' }, heroBranding.wordmark)
      )
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

  function ProjectList({ projects, selectedProject, onSelect }) {
    return React.createElement('div', { className: 'aa-hermes-stack' },
      projects.map((project) => {
        const selected = selectedProject && selectedProject.id === project.id;
        return React.createElement('div', { className: 'aa-hermes-project-row', key: project.id || project.name },
          React.createElement('div', { className: 'aa-hermes-stack aa-hermes-stack-tight' },
            React.createElement('strong', null, project.label),
            React.createElement('span', { className: 'aa-hermes-muted' }, project.allowedOrigins.join(', ') || 'No allowed origins')
          ),
          React.createElement(Button, {
            className: selected ? 'aa-hermes-button aa-hermes-button-secondary' : 'aa-hermes-button',
            onClick: function () { onSelect(project.id); }
          }, selected ? 'Selected' : 'Use this project')
        );
      })
    );
  }

  function SummaryView({ summary, selectedProject, onRefresh }) {
    const header = summarizeProjectHeader({ ...summary, selectedProject });
    const kpis = buildKpiCards(summary);
    const topEvents = ((summary.stats || {}).events || []).slice(0, 6);
    const topPages = ((summary.pages || {}).rows || (summary.pages || {}).pages || []).slice(0, 6);
    const recentEvents = ((summary.events || {}).events || []).slice(0, 8);
    const insights = Array.isArray((summary.insights || {}).insights) ? summary.insights.insights.slice(0, 5) : [];

    return React.createElement('div', { className: 'aa-hermes-stack aa-hermes-plugin' },
      React.createElement(Card, { className: 'aa-hermes-card aa-hermes-card-hero' },
        React.createElement(CardHeader, { className: 'aa-hermes-header-row' },
          React.createElement('div', { className: 'aa-hermes-stack' },
            React.createElement(BrandLockup, null),
            React.createElement('div', { className: 'aa-hermes-stack aa-hermes-stack-tight' },
              React.createElement('p', { className: 'aa-hermes-kicker' }, 'Selected project'),
              React.createElement(CardTitle, { className: 'aa-hermes-title' }, header.name),
              React.createElement('span', { className: 'aa-hermes-muted' }, header.originsLabel)
            )
          ),
          React.createElement(Button, { className: 'aa-hermes-button aa-hermes-button-light', onClick: onRefresh }, 'Refresh')
        ),
        React.createElement(CardContent, { className: 'aa-hermes-grid aa-hermes-grid-kpis' },
          kpis.map((card) => React.createElement('div', { className: 'aa-hermes-kpi', key: card.label },
            React.createElement('span', { className: 'aa-hermes-label' }, card.label),
            React.createElement('strong', null, card.value)
          ))
        )
      ),
      React.createElement('div', { className: 'aa-hermes-grid aa-hermes-grid-panels' },
        React.createElement(Card, { className: 'aa-hermes-card' },
          React.createElement(CardHeader, null, React.createElement(CardTitle, { className: 'aa-hermes-subtitle' }, 'Top Pages')),
          React.createElement(CardContent, { className: 'aa-hermes-stack aa-hermes-stack-tight' },
            topPages.length
              ? topPages.map((row, index) => React.createElement('div', { className: 'aa-hermes-list-row', key: `${row.path || row.page || 'page'}-${index}` },
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
              ? topEvents.map((row, index) => React.createElement('div', { className: 'aa-hermes-list-row', key: `${row.event}-${index}` },
                  React.createElement('span', null, row.event || '(unknown)'),
                  React.createElement('strong', null, String(row.count || 0))
                ))
              : React.createElement('p', { className: 'aa-hermes-muted' }, 'No event data yet.')
          )
        )
      ),
      React.createElement('div', { className: 'aa-hermes-grid aa-hermes-grid-panels' },
        React.createElement(Card, { className: 'aa-hermes-card' },
          React.createElement(CardHeader, null, React.createElement(CardTitle, { className: 'aa-hermes-subtitle' }, 'Insights')),
          React.createElement(CardContent, { className: 'aa-hermes-stack aa-hermes-stack-tight' },
            insights.length
              ? insights.map((item, index) => React.createElement('div', { className: 'aa-hermes-insight', key: `insight-${index}` },
                  React.createElement('strong', null, item.title || item.label || `Insight ${index + 1}`),
                  React.createElement('p', { className: 'aa-hermes-muted' }, item.summary || item.description || '')
                ))
              : React.createElement('p', { className: 'aa-hermes-muted' }, 'No insights available for this project yet.')
          )
        ),
        React.createElement(Card, { className: 'aa-hermes-card' },
          React.createElement(CardHeader, null, React.createElement(CardTitle, { className: 'aa-hermes-subtitle' }, 'Recent Events')),
          React.createElement(CardContent, { className: 'aa-hermes-stack aa-hermes-stack-tight' },
            recentEvents.length
              ? recentEvents.map((event, index) => React.createElement('div', { className: 'aa-hermes-event', key: `${event.event || 'event'}-${index}` },
                  React.createElement('strong', null, event.event || '(unknown event)'),
                  React.createElement('span', { className: 'aa-hermes-muted' }, event.properties && event.properties.path ? event.properties.path : 'No path')
                ))
              : React.createElement('p', { className: 'aa-hermes-muted' }, 'No recent events for this time window.')
          )
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

    const projects = useMemo(() => normalizeProjects((status || {}).projects || []), [status]);
    const view = derivePluginView(status || {});

    useEffect(function () {
      document.documentElement.style.setProperty('--aa-hermes-shell-bg', HERMES_THEME_TOKENS.shellBg);
      document.documentElement.style.setProperty('--aa-hermes-panel-bg', HERMES_THEME_TOKENS.panelBg);
      return function cleanup() {
        document.documentElement.style.removeProperty('--aa-hermes-shell-bg');
        document.documentElement.style.removeProperty('--aa-hermes-panel-bg');
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
    }, [status && status.selectedProject ? status.selectedProject.id : '']);

    function handleStartAuth() {
      setError('');
      postJSON(AUTH_START_URL, {})
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

    function handleSelectProject(projectId) {
      postJSON(PROJECT_SELECT_URL, { project_id: projectId })
        .then((data) => setStatus(data))
        .catch((err) => setError(err.message || 'Failed to select project.'));
    }

    if (loadingStatus && !status) {
      return React.createElement('div', { className: 'aa-hermes-stack aa-hermes-plugin' },
        React.createElement(Card, { className: 'aa-hermes-card' },
          React.createElement(CardContent, { className: 'aa-hermes-stack' },
            React.createElement('p', { className: 'aa-hermes-muted' }, 'Loading Agent Analytics…')
          )
        )
      );
    }

    return React.createElement('div', { className: 'aa-hermes-stack aa-hermes-plugin' },
      React.createElement(Card, { className: 'aa-hermes-card aa-hermes-card-header' },
        React.createElement(CardHeader, { className: 'aa-hermes-header-row' },
          React.createElement('div', { className: 'aa-hermes-stack aa-hermes-stack-tight' },
            React.createElement(BrandLockup, null),
            React.createElement(CardTitle, { className: 'aa-hermes-title' }, heroBranding.wordmark),
            React.createElement('span', { className: 'aa-hermes-muted' }, 'Dashboard-only read plugin for Hermes')
          ),
          status && status.auth && status.auth.connected
            ? React.createElement(Badge, { variant: 'outline', className: 'aa-hermes-badge' }, status.auth.tier || 'connected')
            : null
        ),
        React.createElement(CardContent, { className: 'aa-hermes-stack aa-hermes-stack-tight' },
          status && status.auth && status.auth.connected
            ? React.createElement('div', { className: 'aa-hermes-actions' },
                React.createElement('span', { className: 'aa-hermes-muted' }, status.auth.accountSummary && status.auth.accountSummary.email ? status.auth.accountSummary.email : 'Connected'),
                React.createElement(Button, { className: 'aa-hermes-button aa-hermes-button-light', onClick: handleDisconnect }, 'Disconnect')
              )
            : React.createElement('span', { className: 'aa-hermes-muted' }, 'Use an existing Agent Analytics account to connect this Hermes dashboard tab.')
        )
      ),
      error ? React.createElement('div', { className: 'aa-hermes-error' }, error) : null,
      view === 'login'
        ? React.createElement(EmptyState, {
            kicker: 'Connect account',
            title: 'Log in to an existing Agent Analytics account',
            actions: [
              React.createElement(Button, { className: 'aa-hermes-button', key: 'login', onClick: handleStartAuth }, 'Log in'),
              React.createElement('a', { className: 'aa-hermes-doc-link', href: HERMES_SKILL_DOCS_URL, key: 'docs', target: '_blank', rel: 'noreferrer' }, 'Use the Hermes skill/setup flow first')
            ]
          },
            React.createElement('p', { className: 'aa-hermes-muted' }, 'If the account or project is not ready yet, do setup first through the Agent Analytics Hermes skill, then come back here to connect and read data.')
          )
        : null,
      view === 'pending'
        ? React.createElement(EmptyState, {
            kicker: 'Waiting for approval',
            title: 'Finish login in the browser',
            actions: React.createElement(Button, { className: 'aa-hermes-button aa-hermes-button-light', onClick: loadStatus }, 'Refresh status')
          },
            React.createElement('p', { className: 'aa-hermes-muted' }, 'This tab updates automatically while Agent Analytics waits for browser approval.')
          )
        : null,
      view === 'project-selection'
        ? React.createElement(EmptyState, {
            kicker: 'Choose project',
            title: 'Select the Agent Analytics project for this Hermes plugin'
          },
            React.createElement('p', { className: 'aa-hermes-muted' }, 'Once a project is selected, this tab shows a read-only summary of traffic, pages, events, and insights.'),
            React.createElement(ProjectList, { projects, selectedProject: status.selectedProject, onSelect: handleSelectProject })
          )
        : null,
      view === 'ready'
        ? (loadingSummary && !summary
            ? React.createElement(Card, { className: 'aa-hermes-card' },
                React.createElement(CardContent, { className: 'aa-hermes-stack' },
                  React.createElement('p', { className: 'aa-hermes-muted' }, 'Loading project summary…')
                )
              )
            : React.createElement(SummaryView, { summary: summary || {}, selectedProject: status.selectedProject, onRefresh: loadSummary }))
        : null
    );
  }

  window.__HERMES_PLUGINS__.register('agent-analytics', AgentAnalyticsPage);
})();
