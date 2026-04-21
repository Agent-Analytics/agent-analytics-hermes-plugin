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

## Development

```bash
npm install
npm test
npm run build
```
