'use client';
import React, { useState, useEffect } from 'react';
import { api, formatBytes } from '../../lib/api';
import type { ScanSession, FileTypeInfo } from '../../lib/types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const card = {
  background: '#0A1628',
  border: '1px solid #1e293b',
  borderRadius: 12,
  padding: '20px 24px',
} as React.CSSProperties;

const label = { fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 1 };

export default function TypesPage() {
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [types, setTypes] = useState<FileTypeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSessions().then((data: ScanSession[]) => {
      const completed = data.filter(s => s.status === 'completed');
      setSessions(completed);
      if (completed.length > 0) {
        const latest = completed[0];
        setSessionId(latest.id);
        loadTypes(latest.id);
      }
    }).catch(() => {});
  }, []);

  async function loadTypes(id: string) {
    setLoading(true);
    setError('');
    setTypes([]);
    try {
      const data = await api.getFileTypes(id);
      const arr = Array.isArray(data) ? data : (data.types || data.fileTypes || []);
      setTypes(arr.sort((a: FileTypeInfo, b: FileTypeInfo) => b.totalBytes - a.totalBytes));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load file types');
    } finally {
      setLoading(false);
    }
  }

  function handleSessionChange(id: string) {
    setSessionId(id);
    loadTypes(id);
  }

  const totalBytes = types.reduce((s, t) => s + (t.totalBytes || 0), 0);
  const pieData = types.slice(0, 10).map(t => ({ name: t.extension || '(none)', value: t.totalBytes }));

  return (
    <div style={{ padding: 32, background: '#060B18', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>File Types</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Breakdown of storage usage by file extension.</p>

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

      {loading && <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>Loading file types...</div>}

      {!loading && types.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 }}>
          {/* Pie */}
          <div style={card}>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#fff', marginBottom: 16 }}>Distribution (Top 10)</div>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" paddingAngle={2}>
                  {pieData.map((_: unknown, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatBytes(v)} contentStyle={{ background: '#0A1628', border: '1px solid #1e293b', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {pieData.map((d: { name: string; value: number }, i: number) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#94a3b8', flex: 1 }}>{d.name}</span>
                  <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{formatBytes(d.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={card}>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#fff', marginBottom: 16 }}>All Extensions — {formatBytes(totalBytes)} total</div>
            <div style={{ overflowY: 'auto' as const, maxHeight: 480 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ position: 'sticky' as const, top: 0, background: '#0A1628' }}>
                    {['Extension', 'Files', 'Total Size', 'Share'].map(h => (
                      <th key={h} style={{ textAlign: 'left' as const, padding: '8px 12px', fontSize: 11, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 1, borderBottom: '1px solid #1e293b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {types.map((t, idx) => {
                    const pct = totalBytes > 0 ? ((t.totalBytes / totalBytes) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #0f172a' }}>
                        <td style={{ padding: '9px 12px', fontSize: 13, color: '#6366f1', fontWeight: 600, fontFamily: 'monospace' }}>{t.extension || '(none)'}</td>
                        <td style={{ padding: '9px 12px', fontSize: 13, color: '#94a3b8' }}>{t.count?.toLocaleString()}</td>
                        <td style={{ padding: '9px 12px', fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{formatBytes(t.totalBytes)}</td>
                        <td style={{ padding: '9px 12px', fontSize: 13 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: COLORS[idx % COLORS.length], borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, color: '#64748b', width: 36, textAlign: 'right' as const }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && types.length === 0 && !error && (
        <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No file type data available</div>
        </div>
      )}
    </div>
  );
}