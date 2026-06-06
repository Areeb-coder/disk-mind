'use client';
import React, { useState, useEffect } from 'react';
import { api, formatBytes } from '../../lib/api';
import type { CleanupHistory } from '../../lib/types';

const card = {
  background: '#0A1628',
  border: '1px solid #1e293b',
  borderRadius: 12,
  padding: '20px 24px',
} as React.CSSProperties;

const label = { fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 1 };

export default function HistoryPage() {
  const [history, setHistory] = useState<CleanupHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rollbackStatus, setRollbackStatus] = useState<Record<string, 'loading' | 'done' | 'error'>>({});

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getHistory();
      setHistory(Array.isArray(data) ? data : (data.history || []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }

  async function handleRollback(id: string) {
    setRollbackStatus(prev => ({ ...prev, [id]: 'loading' }));
    try {
      await api.rollback(id);
      setRollbackStatus(prev => ({ ...prev, [id]: 'done' }));
      await loadHistory();
    } catch {
      setRollbackStatus(prev => ({ ...prev, [id]: 'error' }));
    }
  }

  const totalFreed = history.reduce((s, h) => s + (h.bytesFreed || 0), 0);
  const totalDeleted = history.reduce((s, h) => s + (h.filesDeleted || 0), 0);

  return (
    <div style={{ padding: 32, background: '#060B18', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Execution History</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Review and rollback past cleanup operations.</p>

      {!loading && history.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <div style={card}>
            <div style={label}>Total Space Freed</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#10b981' }}>{formatBytes(totalFreed)}</div>
          </div>
          <div style={card}>
            <div style={label}>Files Deleted</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{totalDeleted.toLocaleString()}</div>
          </div>
          <div style={card}>
            <div style={label}>Cleanup Runs</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{history.length}</div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', color: '#fca5a5', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>Loading history...</div>}

      {!loading && history.length === 0 && !error && (
        <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗒️</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No cleanup history yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Run a cleanup from the Cleanup Center to see history here.</div>
        </div>
      )}

      {!loading && history.length > 0 && (
        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date & Time', 'Files Deleted', 'Space Freed', 'Status', 'Rollback'].map(h => (
                  <th key={h} style={{ textAlign: 'left' as const, padding: '8px 12px', fontSize: 11, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 1, borderBottom: '1px solid #1e293b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...history].sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()).map(h => {
                const rb = rollbackStatus[h.id];
                return (
                  <tr key={h.id} style={{ borderBottom: '1px solid #0f172a' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#111827')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 12px', fontSize: 13, color: '#94a3b8' }}>
                      <div>{new Date(h.executedAt).toLocaleDateString()}</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{new Date(h.executedAt).toLocaleTimeString()}</div>
                    </td>
                    <td style={{ padding: '12px 12px', fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{h.filesDeleted?.toLocaleString()}</td>
                    <td style={{ padding: '12px 12px', fontSize: 13, color: '#10b981', fontWeight: 700 }}>{formatBytes(h.bytesFreed)}</td>
                    <td style={{ padding: '12px 12px', fontSize: 12 }}>
                      <span style={{
                        background: h.status === 'completed' ? '#052e16' : h.status === 'rolledback' ? '#1c1200' : '#450a0a',
                        color: h.status === 'completed' ? '#4ade80' : h.status === 'rolledback' ? '#fbbf24' : '#f87171',
                        borderRadius: 4, padding: '3px 10px', fontWeight: 500,
                      }}>{h.status}</span>
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      {h.rollbackPath && h.status !== 'rolledback' ? (
                        <button
                          onClick={() => handleRollback(h.id)}
                          disabled={rb === 'loading' || rb === 'done'}
                          style={{
                            background: rb === 'done' ? '#10b981' : rb === 'error' ? '#ef4444' : '#1e293b',
                            color: '#fff', border: 'none', borderRadius: 6,
                            padding: '5px 14px', fontSize: 12, cursor: rb === 'loading' ? 'wait' : 'pointer',
                            fontWeight: 500, transition: 'background 0.2s',
                          }}
                        >
                          {rb === 'loading' ? 'Rolling back...' : rb === 'done' ? '✓ Done' : rb === 'error' ? '✗ Failed' : '↩ Rollback'}
                        </button>
                      ) : (
                        <span style={{ color: '#334155', fontSize: 12 }}>
                          {h.status === 'rolledback' ? 'Rolled back' : '—'}
                        </span>
                      )}
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
