# Agent Analytics Hermes Plugin
<img width="1489" height="1056" alt="image" src="https://github.com/user-attachments/assets/5c619893-ae0b-425b-97f3-c65d1cbebc28" />

Dashboard-only read plugin for Hermes.

v1 scope:
- browser-login-first for existing Agent Analytics accounts
- project selection inside the Hermes dashboard
- read-only project summary, pages, events, and insights
- empty states that point users back to the Agent Analytics Hermes skill when setup is not done yet

## Install in local Hermes

Install from GitHub with the Hermes plugin installer:

```bash
hermes plugins install Agent-Analytics/agent-analytics-hermes-plugin --enable
hermes dashboard
```

Update an existing install:

```bash
hermes plugins update agent-analytics
hermes dashboard
```

Clean reinstall:

```bash
rm -rf ~/.hermes/plugins/agent-analytics-hermes-plugin  # legacy install path, safe to remove
hermes plugins install Agent-Analytics/agent-analytics-hermes-plugin --force --enable
hermes dashboard
```

The plugin appears as a `Signals` item in the Hermes web dashboard's left sidebar, using a monochrome Agent Analytics logo as its menu icon.

## Telemetry

This plugin includes telemetry. Usage of this plugin is reported to Agent Analytics so we can understand how the product is used and improve the experience.

## Development

```bash
npm install
npm test
npm run build
```
