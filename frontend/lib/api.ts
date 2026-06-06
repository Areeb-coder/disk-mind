let _config: { port: number; token: string } | null = null;

async function getConfig() {
  if (_config) return _config;
  try {
    const res = await fetch('/config.json');
    _config = await res.json();
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('diskmind_token');
      const storedPort = localStorage.getItem('diskmind_port');
      if (stored) _config!.token = stored;
      if (storedPort) _config!.port = parseInt(storedPort);
    }
  } catch {
    _config = { port: 5000, token: '' };
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('diskmind_token');
      if (stored) _config!.token = stored;
    }
  }
  return _config!;
}

async function apiFetch(path: string, options?: RequestInit) {
  const cfg = await getConfig();
  const url = `http://localhost:${cfg.port}${path}`;
  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-DiskMind-Token': cfg.token,
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  // Scan
  startScan: (path: string) => apiFetch('/api/scan/start', { method: 'POST', body: JSON.stringify({ path }) }),
  stopScan: () => apiFetch('/api/scan/stop', { method: 'POST' }),
  getScanStatus: () => apiFetch('/api/scan/status'),
  getSessions: () => apiFetch('/api/scan/sessions'),

  // Analytics
  getAnalytics: (sessionId: string) => apiFetch(`/api/analytics/${sessionId}`),
  getBreakdown: (sessionId: string) => apiFetch(`/api/analytics/breakdown/${sessionId}`),
  getFileTypes: (sessionId: string) => apiFetch(`/api/analytics/filetypes/${sessionId}`),
  getApplications: (sessionId: string) => apiFetch(`/api/analytics/applications/${sessionId}`),
  getDeveloper: (sessionId: string) => apiFetch(`/api/analytics/developer/${sessionId}`),
  getGaming: (sessionId: string) => apiFetch(`/api/analytics/gaming/${sessionId}`),
  getTrends: () => apiFetch('/api/analytics/trends'),
  getReport: (sessionId: string) => apiFetch(`/api/analytics/report/${sessionId}`),

  // Explorer
  browse: (sessionId: string, path: string) =>
    apiFetch(`/api/explorer?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`),

  // Cleanup
  getRecommendations: (sessionId: string) => apiFetch(`/api/cleanup/recommendations/${sessionId}`),
  executeCleanup: (sessionId: string, ids: string[]) =>
    apiFetch('/api/cleanup/execute', { method: 'POST', body: JSON.stringify({ sessionId, recommendationIds: ids }) }),
  getHistory: () => apiFetch('/api/cleanup/history'),
  rollback: (executionId: string) => apiFetch(`/api/cleanup/rollback/${executionId}`, { method: 'POST' }),
  getDuplicates: (sessionId: string) => apiFetch(`/api/cleanup/duplicates/${sessionId}`),
};

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes >= 1_099_511_627_776) return `${(bytes / 1_099_511_627_776).toFixed(1)} TB`;
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
