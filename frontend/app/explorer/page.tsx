'use client';
import React, { useState, useEffect } from 'react';
import { api, formatBytes } from '../../lib/api';
import type { ScanSession, ExplorerItem } from '../../lib/types';

const card = {
  background: '#0A1628',
  border: '1px solid #1e293b',
  borderRadius: 12,
  padding: '20px 24px',
} as React.CSSProperties;

const label = { fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 1 };

export default function ExplorerPage() {
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<ExplorerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    api.getSessions().then((data: ScanSession[]) => {
      const completed = data.filter((s) => s.status === 'completed');
      setSessions(completed);
      if (completed.length > 0) {
        const latest = completed[0]; // completed[0] is latest since sorted DESC
        setSessionId(latest.id);
        const rPath = latest.rootPath || latest.root_path || '';
        setCurrentPath(rPath);
        setHistory([rPath]);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (sessionId && currentPath) {
      browse(currentPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, currentPath]);

  async function browse(path: string) {
    setLoading(true);
    setError('');
    try {
      const data = await api.browse(sessionId, path);
      setItems(Array.isArray(data) ? data : (data.items || []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load directory');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function navigateTo(path: string) {
    setHistory(prev => [...prev, path]);
    setCurrentPath(path);
  }

  function navigateBack() {
    if (history.length <= 1) return;
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    setCurrentPath(newHistory[newHistory.length - 1]);
  }

  function handleSessionChange(id: string) {
    const s = sessions.find(x => x.id === id);
    setSessionId(id);
    if (s) {
      const rPath = s.rootPath || s.root_path || '';
      setCurrentPath(rPath);
      setHistory([rPath]);
    }
  }

  const breadcrumbs = (currentPath || '').split(/[\\/]/).filter(Boolean);

  const sortedItems = [...items].sort((a, b) => {
    if (a.is_directory !== b.is_directory) return b.is_directory - a.is_directory;
    return b.size_bytes - a.size_bytes;
  });

  return (
    <div style={{ padding: 32, background: '#060B18', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>File Explorer</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Browse your scanned drive structure by folder and file.</p>

      {/* Session Selector */}
      <div style={{ ...card, marginBottom: 20, display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' as const }}>
        <div style={{ minWidth: 280 }}>
          <div style={label}>Scan Session</div>
          <select
            value={sessionId}
            onChange={e => handleSessionChange(e.target.value)}
            style={{ background: '#060B18', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', fontSize: 14, width: '100%' }}
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
        <button
          onClick={navigateBack}
          disabled={history.length <= 1}
          style={{
            background: history.length <= 1 ? '#1e293b' : '#6366f1', color: '#fff', border: 'none',
            borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 14,
            cursor: history.length <= 1 ? 'not-allowed' : 'pointer', opacity: history.length <= 1 ? 0.5 : 1,
          }}
        >
          ← Back
        </button>
      </div>

      {/* Breadcrumb */}
      <div style={{ ...card, marginBottom: 16, padding: '12px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' as const, fontSize: 13 }}>
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ color: '#334155', margin: '0 2px' }}>›</span>}
              <span style={{ color: i === breadcrumbs.length - 1 ? '#e2e8f0' : '#6366f1', cursor: i < breadcrumbs.length - 1 ? 'pointer' : 'default' }}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', color: '#fca5a5', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* File Table */}
      <div style={card}>
        {loading ? (
          <div style={{ textAlign: 'center' as const, color: '#475569', padding: 40 }}>Loading...</div>
        ) : sortedItems.length === 0 ? (
          <div style={{ textAlign: 'center' as const, color: '#475569', padding: 40 }}>No items in this directory.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Size', 'Files', 'Type', 'Category'].map(h => (
                  <th key={h} style={{ textAlign: 'left' as const, padding: '8px 12px', fontSize: 11, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 1, borderBottom: '1px solid #1e293b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, idx) => (
                <tr
                  key={idx}
                  onClick={() => item.is_directory ? navigateTo(item.full_path) : undefined}
                  style={{
                    borderBottom: '1px solid #0f172a', cursor: item.is_directory ? 'pointer' : 'default',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#111827')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{item.is_directory ? '📁' : '📄'}</span>
                    <span style={{ color: item.is_directory ? '#6366f1' : '#e2e8f0', fontWeight: item.is_directory ? 600 : 400 }}>{item.name}</span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#94a3b8' }}>{formatBytes(item.size_bytes)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#94a3b8' }}>{item.is_directory ? item.file_count?.toLocaleString() : '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#64748b' }}>{item.extension || (item.is_directory ? 'Folder' : 'File')}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>
                    {item.category && (
                      <span style={{ background: '#1e293b', borderRadius: 4, padding: '2px 8px', color: '#94a3b8' }}>{item.category}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
