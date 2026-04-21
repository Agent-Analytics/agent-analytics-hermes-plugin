# Agent Analytics Hermes Plugin

Dashboard-only read plugin for Hermes.

v1 scope:
- browser-login-first for existing Agent Analytics accounts
- project selection inside the Hermes dashboard
- read-only project summary, pages, events, and insights
- empty states that point users back to the Agent Analytics Hermes skill when setup is not done yet

## Local install for Hermes

```bash
mkdir -p ~/.hermes/plugins
ln -s "$(pwd)" ~/.hermes/plugins/agent-analytics
hermes dashboard
```

The plugin appears as a `Signals` tab in the Hermes web dashboard.

## Telemetry

When the Hermes host already has the Agent Analytics tracker loaded, this plugin reuses that same Agent Analytics token and emits Hermes-scoped events through `window.aa`.

Telemetry ids and feature names are prefixed with `hermes_plugin_` so plugin usage stays easy to filter alongside the rest of Agent Analytics.

Event names are also prefixed, e.g. `hermes_plugin_cta_click`, so Hermes traffic is obvious in raw event streams.

## Development

```bash
npm install
npm test
npm run build
```
