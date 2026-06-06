'use client';
import React, { useState, useEffect } from 'react';
import { api, formatBytes } from '../../lib/api';
import type { ScanSession, CleanupRecommendation, CleanupHistory } from '../../lib/types';

const card = {
  background: '#0A1628',
  border: '1px solid #1e293b',
  borderRadius: 12,
  padding: '20px 24px',
} as React.CSSProperties;

const label = { fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 1 };

const riskStyles: Record<string, { bg: string; color: string; border: string }> = {
  Safe: { bg: '#052e16', color: '#4ade80', border: '#166534' },
  Moderate: { bg: '#1c1200', color: '#fbbf24', border: '#92400e' },
  Caution: { bg: '#450a0a', color: '#f87171', border: '#7f1d1d' },
  Review: { bg: '#0f172a', color: '#94a3b8', border: '#334155' },
};

export default function RecommendationsPage() {
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [recs, setRecs] = useState<CleanupRecommendation[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<CleanupHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<{ filesDeleted: number; bytesFreed: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSessions().then((data: ScanSession[]) => {
      const completed = data.filter(s => s.status === 'completed');
      setSessions(completed);
      if (completed.length > 0) {
        const latest = completed[0];
        setSessionId(latest.id);
        loadRecs(latest.id);
      }
    }).catch(() => {});
    api.getHistory().then((h: CleanupHistory[]) => setHistory(Array.isArray(h) ? h : [])).catch(() => {});
  }, []);

  async function loadRecs(id: string) {
    setLoading(true);
    setError('');
    setRecs([]);
    setSelected(new Set());
    setExecResult(null);
    try {
      const data = await api.getRecommendations(id);
      setRecs(Array.isArray(data) ? data : (data.recommendations || []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }

  function handleSessionChange(id: string) {
    setSessionId(id);
    loadRecs(id);
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll(level: string) {
    const ids = recs.filter(r => r.riskLevel === level).map(r => r.id);
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
  }

  async function handleExecute() {
    if (selected.size === 0) return;
    setExecuting(true);
    setExecResult(null);
    setError('');
    try {
      const result = await api.executeCleanup(sessionId, Array.from(selected));
      setExecResult(result);
      setSelected(new Set());
      const h = await api.getHistory();
      setHistory(Array.isArray(h) ? h : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cleanup failed');
    } finally {
      setExecuting(false);
    }
  }

  const groups: Record<string, CleanupRecommendation[]> = { Safe: [], Moderate: [], Caution: [], Review: [] };
  recs.forEach(r => {
    const key = r.riskLevel in groups ? r.riskLevel : 'Review';
    groups[key].push(r);
  });

  const selectedBytes = recs.filter(r => selected.has(r.id)).reduce((s, r) => s + (r.estimatedBytes || 0), 0);

  return (
    <div style={{ padding: 32, background: '#060B18', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Cleanup Center</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Review and execute storage cleanup recommendations.</p>

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

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', color: '#fca5a5', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {execResult && (
        <div style={{ background: '#052e16', border: '1px solid #166534', borderRadius: 8, padding: '14px 20px', color: '#4ade80', marginBottom: 16, fontSize: 14 }}>
          ✅ Cleanup complete! Deleted {execResult.filesDeleted} files, freed {formatBytes(execResult.bytesFreed)}.
        </div>
      )}

      {/* Execute Bar */}
      {selected.size > 0 && (
        <div style={{ ...card, marginBottom: 20, background: '#0f1d35', borderColor: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{selected.size} item{selected.size > 1 ? 's' : ''} selected</span>
            <span style={{ color: '#f59e0b', fontWeight: 700, marginLeft: 12 }}>{formatBytes(selectedBytes)} to free</span>
          </div>
          <button
            onClick={handleExecute}
            disabled={executing}
            style={{
              background: executing ? '#334155' : 'linear-gradient(135deg, #6366f1, #3b82f6)',
              color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px',
              fontWeight: 700, fontSize: 14, cursor: executing ? 'not-allowed' : 'pointer',
            }}
          >
            {executing ? 'Running...' : '🧹 Run Selected Cleanups'}
          </button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>Loading recommendations...</div>
      )}

      {/* Risk Groups */}
      {['Safe', 'Moderate', 'Caution', 'Review'].map(level => {
        const items = groups[level];
        if (!items || items.length === 0) return null;
        const rs = riskStyles[level];
        return (
          <div key={level} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: rs.bg, border: `1px solid ${rs.border}`, color: rs.color, borderRadius: 6, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{level}</span>
                <span style={{ color: '#64748b', fontSize: 13 }}>{items.length} item{items.length > 1 ? 's' : ''} — {formatBytes(items.reduce((s, r) => s + r.estimatedBytes, 0))}</span>
              </div>
              <button
                onClick={() => selectAll(level)}
                style={{ background: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
              >
                Select All {level}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              {items.map(rec => (
                <div
                  key={rec.id}
                  onClick={() => toggleSelect(rec.id)}
                  style={{
                    ...card,
                    cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14,
                    borderColor: selected.has(rec.id) ? '#6366f1' : '#1e293b',
                    background: selected.has(rec.id) ? '#0f1d35' : '#0A1628',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected.has(rec.id) ? '#6366f1' : '#334155'}`,
                    background: selected.has(rec.id) ? '#6366f1' : 'transparent', flexShrink: 0, marginTop: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                  }}>
                    {selected.has(rec.id) && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#e2e8f0', marginBottom: 4 }}>{rec.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{rec.description}</div>
                    {rec.paths && rec.paths.length > 0 && (
                      <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
                        {rec.paths.slice(0, 2).map((p, i) => <div key={i}>{p}</div>)}
                        {rec.paths.length > 2 && <div>+{rec.paths.length - 2} more</div>}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>{formatBytes(rec.estimatedBytes)}</div>
                    <div style={{ fontSize: 11, color: rs.color, marginTop: 4 }}>{rec.riskLevel}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Cleanup History */}
      {history.length > 0 && (
        <div style={{ ...card, marginTop: 32 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#fff', marginBottom: 16 }}>Cleanup History</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Files Deleted', 'Space Freed', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left' as const, padding: '8px 12px', fontSize: 11, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 1, borderBottom: '1px solid #1e293b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} style={{ borderBottom: '1px solid #0f172a' }}>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#94a3b8' }}>{new Date(h.executedAt).toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#e2e8f0' }}>{h.filesDeleted}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>{formatBytes(h.bytesFreed)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>
                    <span style={{ background: h.status === 'completed' ? '#052e16' : '#450a0a', color: h.status === 'completed' ? '#4ade80' : '#f87171', borderRadius: 4, padding: '2px 8px' }}>{h.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
