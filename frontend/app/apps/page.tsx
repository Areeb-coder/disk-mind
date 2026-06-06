'use client';
import React, { useState, useEffect } from 'react';
import { api, formatBytes } from '../../lib/api';
import type { ScanSession } from '../../lib/types';

const card = {
  background: '#0A1628',
  border: '1px solid #1e293b',
  borderRadius: 12,
  padding: '20px 24px',
} as React.CSSProperties;

const label = { fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 1 };

interface AppItem {
  name: string;
  install_path: string;
  total_size_bytes: number;
  cache_size_bytes: number;
  category: string;
}

const categoryColors: Record<string, string> = {
  productivity: '#6366f1',
  gaming: '#f97316',
  development: '#10b981',
  media: '#06b6d4',
  system: '#94a3b8',
  browser: '#3b82f6',
  default: '#8b5cf6',
};

export default function AppsPage() {
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'total' | 'cache'>('total');

  useEffect(() => {
    api.getSessions().then((data: ScanSession[]) => {
      const completed = data.filter(s => s.status === 'completed');
      setSessions(completed);
      if (completed.length > 0) {
        const latest = completed[0];
        setSessionId(latest.id);
        loadApps(latest.id);
      }
    }).catch(() => {});
  }, []);

  async function loadApps(id: string) {
    setLoading(true);
    setError('');
    setApps([]);
    try {
      const data = await api.getApplications(id);
      setApps(Array.isArray(data) ? data : (data.applications || data.apps || []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }

  function handleSessionChange(id: string) {
    setSessionId(id);
    loadApps(id);
  }

  const sorted = [...apps].sort((a, b) =>
    sortBy === 'total' ? b.total_size_bytes - a.total_size_bytes : b.cache_size_bytes - a.cache_size_bytes
  );

  const totalBytes = apps.reduce((s, a) => s + (a.total_size_bytes || 0), 0);
  const totalCache = apps.reduce((s, a) => s + (a.cache_size_bytes || 0), 0);

  return (
    <div style={{ padding: 32, background: '#060B18', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Applications</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Installed applications and their storage footprint.</p>

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={label}>Scan Session</div>
        <select
          value={sessionId}
          onChange={e => handleSessionChange(e.target.value)}
          style={{ background: '#060B18', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', fontSize: 14, minWidth: 320 }}
        >
          {sessions.length === 0 && <option value="">No sessions available</option>}
          {sessions.map(s => {
            const rPath = s.rootPath || s.root_path || '';
            const startAt = s.startedAt || s.started_at || '';
            return (
              <option key={s.id} value={s.id}>{rPath} — {new Date(startAt).toLocaleString()}</option>
            );
          })}
        </select>
      </div>

      {!loading && apps.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <div style={card}>
            <div style={label}>Total App Storage</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{formatBytes(totalBytes)}</div>
          </div>
          <div style={card}>
            <div style={label}>Total Cache</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b' }}>{formatBytes(totalCache)}</div>
          </div>
          <div style={card}>
            <div style={label}>Applications Found</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{apps.length}</div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', color: '#fca5a5', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>Loading applications...</div>}

      {!loading && apps.length === 0 && !error && (
        <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🖥️</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No applications found</div>
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#fff' }}>All Applications</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setSortBy('total')}
                style={{ background: sortBy === 'total' ? '#6366f1' : '#1e293b', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}
              >
                Sort by Total
              </button>
              <button
                onClick={() => setSortBy('cache')}
                style={{ background: sortBy === 'cache' ? '#6366f1' : '#1e293b', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}
              >
                Sort by Cache
              </button>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Application', 'Category', 'Install Path', 'Total Size', 'Cache'].map(h => (
                  <th key={h} style={{ textAlign: 'left' as const, padding: '8px 12px', fontSize: 11, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 1, borderBottom: '1px solid #1e293b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((app, idx) => {
                const catColor = categoryColors[app.category?.toLowerCase()] || categoryColors.default;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #0f172a' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#111827')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 12px', fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{app.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>
                      {app.category && (
                        <span style={{ background: `${catColor}22`, color: catColor, border: `1px solid ${catColor}44`, borderRadius: 4, padding: '2px 8px' }}>
                          {app.category}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#475569', fontFamily: 'monospace', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      {app.install_path}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{formatBytes(app.total_size_bytes)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: app.cache_size_bytes > 0 ? '#f59e0b' : '#475569' }}>
                      {app.cache_size_bytes > 0 ? formatBytes(app.cache_size_bytes) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}