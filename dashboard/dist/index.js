(() => {
  // src/dashboard/summary-model.mjs
  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(Number(value || 0));
  }
  function formatShortDate(date) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
  }
  function summarizeTimeframe(summary = {}, now = /* @__PURE__ */ new Date()) {
    const daysRaw = Number(summary?.days || 7);
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.floor(daysRaw) : 7;
    const end = new Date(now);
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - days);
    return {
      label: `Last ${days} days`,
      range: `${formatShortDate(start)} \u2013 ${formatShortDate(end)}`
    };
  }
  function summarizeProjectHeader(summary = {}) {
    const projectName = summary?.project?.project?.name || summary?.selectedProject?.name || "Selected project";
    const origins = summary?.selectedProject?.allowedOrigins;
    return {
      name: projectName,
      originsLabel: Array.isArray(origins) && origins.length ? origins.join(", ") : "No allowed origins saved"
    };
  }
  function buildKpiCards(summary = {}) {
    const totals = summary?.stats?.totals || {};
    const sessions = summary?.stats?.sessions || {};
    const usageToday = summary?.project?.usage_today || {};
    const totalSessions = sessions.totalSessions ?? sessions.total_sessions ?? 0;
    return [
      { label: "Visitors", value: formatNumber(totals.unique_users) },
      { label: "Events", value: formatNumber(totals.total_events) },
      { label: "Sessions", value: formatNumber(totalSessions) },
      { label: "Today", value: `${formatNumber(usageToday.event_count)} events \xB7 ${formatNumber(usageToday.read_count)} reads` }
    ];
  }

  // src/dashboard/theme-model.mjs
  var HERMES_THEME_TOKENS = {
    shellBg: "#032F2F",
    shellBgAlt: "#0C3435",
    panelBg: "#F3F1EA",
    panelBgAlt: "#ECE9E1",
    panelBorder: "#D9D3C5",
    panelText: "#4F4B44",
    panelTextMuted: "#7C766B",
    panelHeading: "#2F332F",
    activeBorder: "#E6E0C8",
    navDivider: "#6E7652",
    kicker: "#0F9F5B",
    link: "#1E5D46",
    metricVisitors: "#57B8B2",
    metricEvents: "#F4A340",
    metricSessions: "#49B37D",
    metricToday: "#E9C46A"
  };
  var heroBranding = {
    logoFile: "agent-analytics-logo-primary-transparent.png",
    wordmark: "Agent Analytics",
    eyebrow: "Hermes dashboard plugin"
  };

  // src/dashboard/state-model.mjs
  function shouldShowAccountCard(view, auth = {}) {
    return Boolean(auth.connected) && view === "ready";
  }

  // src/dashboard/view-model.mjs
  function derivePluginView(status = {}) {
    const auth = status.auth || {};
    if (auth.pendingAuthRequest) return "pending";
    if (!auth.connected) return "login";
    return "ready";
  }

  // src/dashboard/index.js
  (function() {
    const SDK = window.__HERMES_PLUGIN_SDK__;
    const { React } = SDK;
    const { useEffect, useState } = SDK.hooks;
    const { Card, CardHeader, CardTitle, CardContent, Button, Badge } = SDK.components;
    const STATUS_URL = "/api/plugins/agent-analytics/status";
    const SUMMARY_URL = "/api/plugins/agent-analytics/summary";
    const AUTH_START_URL = "/api/plugins/agent-analytics/auth/start";
    const AUTH_POLL_URL = "/api/plugins/agent-analytics/auth/poll";
    const AUTH_DISCONNECT_URL = "/api/plugins/agent-analytics/auth/disconnect";
    const HERMES_SKILL_DOCS_URL = "https://docs.agentanalytics.sh/installation/hermes/";
    const LOGO_SRC = "/dashboard-plugins/agent-analytics/dist/agent-analytics-logo-primary-transparent.png";
    function postJSON(url, body) {
      return SDK.fetchJSON(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
    }
    function BrandLockup() {
      return React.createElement(
        "div",
        { className: "aa-hermes-brand-lockup" },
        React.createElement("img", {
          alt: heroBranding.wordmark,
          className: "aa-hermes-brand-image",
          src: LOGO_SRC
        }),
        React.createElement(
          "div",
          { className: "aa-hermes-stack aa-hermes-stack-tight" },
          React.createElement("p", { className: "aa-hermes-kicker" }, heroBranding.eyebrow),
          React.createElement("strong", { className: "aa-hermes-brand-wordmark" }, heroBranding.wordmark)
        )
      );
    }
    function EmptyState({ children, kicker, title, actions }) {
      return React.createElement(
        Card,
        { className: "aa-hermes-card aa-hermes-empty" },
        React.createElement(
          CardHeader,
          { className: "aa-hermes-header-row aa-hermes-header-row-top" },
          React.createElement(
            "div",
            { className: "aa-hermes-stack aa-hermes-stack-tight" },
            React.createElement("p", { className: "aa-hermes-kicker" }, kicker),
            React.createElement(CardTitle, { className: "aa-hermes-title" }, title)
          ),
          React.createElement(BrandLockup, null)
        ),
        React.createElement(
          CardContent,
          { className: "aa-hermes-stack" },
          children,
          actions ? React.createElement("div", { className: "aa-hermes-actions" }, actions) : null
        )
      );
    }
    function SummaryView({ summary, onRefresh }) {
      const timeframe = summarizeTimeframe(summary);
      const projectSummaries = Array.isArray(summary.projects) ? summary.projects : [];
      return React.createElement(
        "div",
        { className: "aa-hermes-stack aa-hermes-plugin" },
        React.createElement(
          Card,
          { className: "aa-hermes-card aa-hermes-card-hero" },
          React.createElement(
            CardHeader,
            { className: "aa-hermes-header-row" },
            React.createElement(
              "div",
              { className: "aa-hermes-stack" },
              React.createElement(BrandLockup, null),
              React.createElement(
                "div",
                { className: "aa-hermes-stack aa-hermes-stack-tight" },
                React.createElement("p", { className: "aa-hermes-kicker" }, "Portfolio overview"),
                React.createElement(CardTitle, { className: "aa-hermes-title" }, "All Agent Analytics projects"),
                React.createElement("span", { className: "aa-hermes-muted" }, "Showing each project side by side for this account"),
                React.createElement(
                  "div",
                  { className: "aa-hermes-timeframe" },
                  React.createElement("span", { className: "aa-hermes-timeframe-label" }, timeframe.label),
                  React.createElement("span", { className: "aa-hermes-timeframe-range" }, timeframe.range)
                )
              )
            ),
            React.createElement(Button, { className: "aa-hermes-button aa-hermes-button-light", onClick: onRefresh }, "Refresh")
          )
        ),
        projectSummaries.length ? React.createElement(
          "div",
          { className: "aa-hermes-grid aa-hermes-grid-projects" },
          projectSummaries.map((projectSummary, index) => {
            const header = summarizeProjectHeader(projectSummary);
            const kpis = buildKpiCards(projectSummary);
            const topEvents = ((projectSummary.stats || {}).events || []).slice(0, 4);
            const topPages = ((projectSummary.pages || {}).rows || (projectSummary.pages || {}).pages || []).slice(0, 4);
            return React.createElement(
              Card,
              { className: "aa-hermes-card", key: `${header.name}-${index}` },
              React.createElement(
                CardHeader,
                { className: "aa-hermes-stack aa-hermes-stack-tight" },
                React.createElement(CardTitle, { className: "aa-hermes-subtitle" }, header.name),
                React.createElement("span", { className: "aa-hermes-muted" }, header.originsLabel)
              ),
              React.createElement(
                CardContent,
                { className: "aa-hermes-stack" },
                React.createElement(
                  "div",
                  { className: "aa-hermes-grid aa-hermes-grid-kpis" },
                  kpis.map((card) => {
                    const metricClass = `aa-hermes-kpi aa-hermes-kpi-${String(card.label || "").toLowerCase()}`;
                    return React.createElement(
                      "div",
                      { className: metricClass, key: `${header.name}-${card.label}` },
                      React.createElement("span", { className: "aa-hermes-label" }, card.label),
                      React.createElement("strong", null, card.value)
                    );
                  })
                ),
                React.createElement(
                  "div",
                  { className: "aa-hermes-grid aa-hermes-grid-panels" },
                  React.createElement(
                    Card,
                    { className: "aa-hermes-card" },
                    React.createElement(CardHeader, null, React.createElement(CardTitle, { className: "aa-hermes-subtitle" }, "Top Pages")),
                    React.createElement(
                      CardContent,
                      { className: "aa-hermes-stack aa-hermes-stack-tight" },
                      topPages.length ? topPages.map((row, rowIndex) => React.createElement(
                        "div",
                        { className: "aa-hermes-list-row", key: `${row.path || row.page || "page"}-${rowIndex}` },
                        React.createElement("span", null, row.path || row.page || "(unknown)"),
                        React.createElement("strong", null, String(row.visitors || row.count || 0))
                      )) : React.createElement("p", { className: "aa-hermes-muted" }, "No page data yet.")
                    )
                  ),
                  React.createElement(
                    Card,
                    { className: "aa-hermes-card" },
                    React.createElement(CardHeader, null, React.createElement(CardTitle, { className: "aa-hermes-subtitle" }, "Top Events")),
                    React.createElement(
                      CardContent,
                      { className: "aa-hermes-stack aa-hermes-stack-tight" },
                      topEvents.length ? topEvents.map((row, rowIndex) => React.createElement(
                        "div",
                        { className: "aa-hermes-list-row", key: `${row.event || "event"}-${rowIndex}` },
                        React.createElement("span", null, row.event || "(unknown)"),
                        React.createElement("strong", null, String(row.count || 0))
                      )) : React.createElement("p", { className: "aa-hermes-muted" }, "No event data yet.")
                    )
                  )
                )
              )
            );
          })
        ) : React.createElement(
          Card,
          { className: "aa-hermes-card" },
          React.createElement(
            CardContent,
            { className: "aa-hermes-stack" },
            React.createElement("p", { className: "aa-hermes-muted" }, "No projects found for this account.")
          )
        )
      );
    }
    function AgentAnalyticsPage() {
      const [status, setStatus] = useState(null);
      const [summary, setSummary] = useState(null);
      const [error, setError] = useState("");
      const [loadingStatus, setLoadingStatus] = useState(true);
      const [loadingSummary, setLoadingSummary] = useState(false);
      const view = derivePluginView(status || {});
      useEffect(function() {
        document.documentElement.style.setProperty("--aa-hermes-shell-bg", HERMES_THEME_TOKENS.shellBg);
        document.documentElement.style.setProperty("--aa-hermes-panel-bg", HERMES_THEME_TOKENS.panelBg);
        document.documentElement.style.setProperty("--aa-hermes-kicker", HERMES_THEME_TOKENS.kicker);
        document.documentElement.style.setProperty("--aa-hermes-link", HERMES_THEME_TOKENS.link);
        document.documentElement.style.setProperty("--aa-hermes-metric-visitors", HERMES_THEME_TOKENS.metricVisitors);
        document.documentElement.style.setProperty("--aa-hermes-metric-events", HERMES_THEME_TOKENS.metricEvents);
        document.documentElement.style.setProperty("--aa-hermes-metric-sessions", HERMES_THEME_TOKENS.metricSessions);
        document.documentElement.style.setProperty("--aa-hermes-metric-today", HERMES_THEME_TOKENS.metricToday);
        return function cleanup() {
          document.documentElement.style.removeProperty("--aa-hermes-shell-bg");
          document.documentElement.style.removeProperty("--aa-hermes-panel-bg");
          document.documentElement.style.removeProperty("--aa-hermes-kicker");
          document.documentElement.style.removeProperty("--aa-hermes-link");
          document.documentElement.style.removeProperty("--aa-hermes-metric-visitors");
          document.documentElement.style.removeProperty("--aa-hermes-metric-events");
          document.documentElement.style.removeProperty("--aa-hermes-metric-sessions");
          document.documentElement.style.removeProperty("--aa-hermes-metric-today");
        };
      }, []);
      function loadStatus() {
        setLoadingStatus(true);
        setError("");
        return SDK.fetchJSON(STATUS_URL).then((data) => setStatus(data)).catch((err) => setError(err.message || "Failed to load Agent Analytics plugin status.")).finally(() => setLoadingStatus(false));
      }
      function loadSummary() {
        setLoadingSummary(true);
        setError("");
        return SDK.fetchJSON(SUMMARY_URL).then((data) => setSummary(data)).catch((err) => setError(err.message || "Failed to load project summary.")).finally(() => setLoadingSummary(false));
      }
      useEffect(function() {
        loadStatus();
      }, []);
      useEffect(function() {
        if (!status) return void 0;
        if (derivePluginView(status) === "pending") {
          const interval = setInterval(function() {
            postJSON(AUTH_POLL_URL, {}).then((data) => setStatus(data)).catch(() => {
            });
          }, 2500);
          return function cleanup() {
            clearInterval(interval);
          };
        }
        return void 0;
      }, [status]);
      useEffect(function() {
        if (!status) return;
        if (derivePluginView(status) === "ready") {
          loadSummary();
        } else {
          setSummary(null);
        }
      }, [status && status.auth && status.auth.connected ? "connected" : "signed_out"]);
      function handleStartAuth() {
        setError("");
        postJSON(AUTH_START_URL, { dashboard_origin: window.location.origin }).then((data) => {
          setStatus(data);
          const authorizeUrl = data && data.auth && data.auth.pendingAuthRequest && data.auth.pendingAuthRequest.authorizeUrl;
          if (authorizeUrl) window.open(authorizeUrl, "_blank");
        }).catch((err) => setError(err.message || "Failed to start login."));
      }
      function handleDisconnect() {
        postJSON(AUTH_DISCONNECT_URL, {}).then((data) => setStatus(data)).catch((err) => setError(err.message || "Failed to disconnect."));
      }
      if (loadingStatus && !status) {
        return React.createElement(
          "div",
          { className: "aa-hermes-stack aa-hermes-plugin" },
          React.createElement(
            Card,
            { className: "aa-hermes-card" },
            React.createElement(
              CardContent,
              { className: "aa-hermes-stack" },
              React.createElement("p", { className: "aa-hermes-muted" }, "Loading Agent Analytics\u2026")
            )
          )
        );
      }
      return React.createElement(
        "div",
        { className: "aa-hermes-stack aa-hermes-plugin" },
        shouldShowAccountCard(view, status && status.auth ? status.auth : {}) ? React.createElement(
          Card,
          { className: "aa-hermes-card aa-hermes-card-header" },
          React.createElement(
            CardHeader,
            { className: "aa-hermes-header-row" },
            React.createElement(
              "div",
              { className: "aa-hermes-stack aa-hermes-stack-tight" },
              React.createElement(BrandLockup, null),
              React.createElement(CardTitle, { className: "aa-hermes-title" }, heroBranding.wordmark),
              React.createElement("span", { className: "aa-hermes-muted" }, "Dashboard-only read plugin for Hermes")
            ),
            React.createElement(Badge, { variant: "outline", className: "aa-hermes-badge" }, status.auth.tier || "connected")
          ),
          React.createElement(
            CardContent,
            { className: "aa-hermes-stack aa-hermes-stack-tight" },
            React.createElement(
              "div",
              { className: "aa-hermes-actions" },
              React.createElement("span", { className: "aa-hermes-muted" }, status.auth.accountSummary && status.auth.accountSummary.email ? status.auth.accountSummary.email : "Connected"),
              React.createElement(Button, { className: "aa-hermes-button aa-hermes-button-light", onClick: handleDisconnect }, "Disconnect")
            )
          )
        ) : null,
        error ? React.createElement("div", { className: "aa-hermes-error" }, error) : null,
        view === "login" ? React.createElement(
          EmptyState,
          {
            kicker: "Connect account",
            title: "Log in to an existing Agent Analytics account",
            actions: [
              React.createElement(Button, { className: "aa-hermes-button", key: "login", onClick: handleStartAuth }, "Log in"),
              React.createElement("a", { className: "aa-hermes-doc-link", href: HERMES_SKILL_DOCS_URL, key: "docs", target: "_blank", rel: "noreferrer" }, "Use the Hermes skill/setup flow first")
            ]
          },
          React.createElement("p", { className: "aa-hermes-muted" }, "If the account or project is not ready yet, do setup first through the Agent Analytics Hermes skill, then come back here to connect and read data.")
        ) : null,
        view === "pending" ? React.createElement(
          EmptyState,
          {
            kicker: "Waiting for approval",
            title: "Finish login in the browser",
            actions: [
              React.createElement(Button, { className: "aa-hermes-button aa-hermes-button-light", key: "refresh", onClick: loadStatus }, "Refresh status"),
              React.createElement(Button, { className: "aa-hermes-button", key: "restart", onClick: function() {
                handleDisconnect();
                setTimeout(handleStartAuth, 150);
              } }, "Start over")
            ]
          },
          React.createElement("p", { className: "aa-hermes-muted" }, "This tab updates automatically while Agent Analytics waits for browser approval."),
          status && status.auth && status.auth.pendingAuthRequest && status.auth.pendingAuthRequest.authorizeUrl ? React.createElement("a", { className: "aa-hermes-doc-link", href: status.auth.pendingAuthRequest.authorizeUrl, target: "_blank", rel: "noreferrer" }, "Open approval page again") : null
        ) : null,
        view === "ready" ? loadingSummary && !summary ? React.createElement(
          Card,
          { className: "aa-hermes-card" },
          React.createElement(
            CardContent,
            { className: "aa-hermes-stack" },
            React.createElement("p", { className: "aa-hermes-muted" }, "Loading project summary\u2026")
          )
        ) : React.createElement(SummaryView, { summary: summary || {}, onRefresh: loadSummary }) : null
      );
    }
    window.__HERMES_PLUGINS__.register("agent-analytics", AgentAnalyticsPage);
  })();
})();
