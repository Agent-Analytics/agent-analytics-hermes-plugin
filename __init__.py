"""Agent Analytics Hermes dashboard plugin.

The dashboard extension is discovered from dashboard/manifest.json. The
standalone plugin entry point is intentionally a no-op so `hermes plugins
install ... --enable` can manage this dashboard-only plugin cleanly.
"""


def register(ctx):
    """Register no agent tools; dashboard assets are loaded by Hermes Web."""
    return None
