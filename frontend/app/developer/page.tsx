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

interface DevItem {
  tool_type: string;
  name: string;
  path: string;
  size_bytes: number;
}

const toolIcons: Record<string, string> = {
  node_modules: '🟢',
  rust: '🦀',
  dotnet: '🔵',
  python: '🐍',
  default: '📦',
};

const toolColors: Record<string, string> = {
  node_modules: '#22c55e',
  rust: '#f97316',
  dotnet: '#3b82f6',
  python: '#facc15',
  default: '#6366f1',
};

export default function DeveloperPage() {
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [data, setData] = useState<DevItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSessions().then((sess: ScanSession[]) => {
      const completed = sess.filter(s => s.status === 'completed');
      setSessions(completed);
      if (completed.length > 0) {
        const latest = completed[0];
        setSessionId(latest.id);
        loadData(latest.id);
      }
    }).catch(() => {});
  }, []);

  async function loadData(id: string) {
    setLoading(true);
    setError('');
    setData([]);
    try {
      const result = await api.getDeveloper(id);
      setData(Array.isArray(result) ? result : (result.items || result.data || []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load developer data');
    } finally {
      setLoading(false);
    }
  }

  function handleSessionChange(id: string) {
    setSessionId(id);
    loadData(id);
  }

  // Group by tool_type
  const grouped: Record<string, DevItem[]> = {};
  data.forEach(item => {
    const key = item.tool_type || 'default';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  const totalBytes = data.reduce((s, d) => s + (d.size_bytes || 0), 0);

  return (
    <div style={{ padding: 32, background: '#060B18', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Developer Storage</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Analyze storage used by development tools: node_modules, Rust, .NET, Python, and more.</p>

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

      {!loading && data.length > 0 && (
        <div style={{ ...card, marginBottom: 24, display: 'flex', gap: 32 }}>
          <div>
            <div style={label}>Total Dev Storage</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{formatBytes(totalBytes)}</div>
          </div>
          <div>
            <div style={label}>Tool Categories</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{Object.keys(grouped).length}</div>
          </div>
          <div>
            <div style={label}>Total Entries</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{data.length}</div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', color: '#fca5a5', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>Loading developer data...</div>}

      {!loading && data.length === 0 && !error && (
        <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💻</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No developer artifacts found</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>No node_modules, Rust, .NET, or Python caches detected.</div>
        </div>
      )}

      {Object.entries(grouped).map(([toolType, items]) => {
        const icon = toolIcons[toolType] || toolIcons.default;
        const color = toolColors[toolType] || toolColors.default;
        const sectionBytes = items.reduce((s, i) => s + (i.size_bytes || 0), 0);
        return (
          <div key={toolType} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>{icon}</span>
              <span style={{ fontWeight: 700, fontSize: 16, color }}>{toolType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
              <span style={{ color: '#64748b', fontSize: 13 }}>{items.length} items — {formatBytes(sectionBytes)}</span>
            </div>
            <div style={card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Name', 'Path', 'Size'].map(h => (
                      <th key={h} style={{ textAlign: 'left' as const, padding: '8px 12px', fontSize: 11, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 1, borderBottom: '1px solid #1e293b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.sort((a, b) => b.size_bytes - a.size_bytes).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #0f172a' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{item.name}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: '#475569', fontFamily: 'monospace', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.path}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>{formatBytes(item.size_bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}