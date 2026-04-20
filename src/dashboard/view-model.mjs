export function derivePluginView(status = {}) {
  const auth = status.auth || {};
  if (auth.pendingAuthRequest) return 'pending';
  if (!auth.connected) return 'login';
  if (!status.selectedProject) return 'project-selection';
  return 'ready';
}

export function normalizeProjects(projects = []) {
  return (Array.isArray(projects) ? projects : []).map((project) => ({
    id: String(project.id || ''),
    name: String(project.name || ''),
    label: String(project.name || ''),
    allowedOrigins: Array.isArray(project.allowed_origins)
      ? project.allowed_origins
      : project.allowed_origins === '*'
        ? ['*']
        : String(project.allowed_origins || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
  }));
}
