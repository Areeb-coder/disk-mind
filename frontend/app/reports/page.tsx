'use client';
import React, { useState, useEffect } from 'react';
import { api, formatBytes } from '../../lib/api';
import type { ScanSession, IntelligenceReport, StorageAllocation } from '../../lib/types';

const card = {
  background: '#0A1628',
  border: '1px solid #1e293b',
  borderRadius: 12,
  padding: '20px 24px',
} as React.CSSProperties;

const label = { fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 1 };

const riskColor = (r: string) => {
  if (r === 'Safe') return '#4ade80';
  if (r === 'Moderate') return '#fbbf24';
  if (r === 'Caution') return '#f87171';
  return '#94a3b8';
};

export default function ReportsPage() {
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exported, setExported] = useState(false);

  useEffect(() => {
    api.getSessions().then((data: ScanSession[]) => {
      const completed = data.filter(s => s.status === 'completed');
      setSessions(completed);
      if (completed.length > 0) {
        const latest = completed[0];
        setSessionId(latest.id);
        loadReport(latest.id);
      }
    }).catch(() => {});
  }, []);

  async function loadReport(id: string) {
    setLoading(true);
    setError('');
    setReport(null);
    setExported(false);
    try {
      const data = await api.getReport(id);
      setReport(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  function handleSessionChange(id: string) {
    setSessionId(id);
    loadReport(id);
  }

  function exportJSON() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diskmind-report-${sessionId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  }

  const healthColor = (score: number) => score >= 80 ? '#4ade80' : score >= 60 ? '#fbbf24' : '#f87171';

  return (
    <div style={{ padding: 32, background: '#060B18', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>AI Intelligence Reports</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Full storage intelligence report with recommendations and analysis.</p>

      <div style={{ ...card, marginBottom: 20, display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' as const }}>
        <div style={{ flex: 1, minWidth: 280 }}>
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
          onClick={exportJSON}
          disabled={!report}
          style={{
            background: exported ? '#10b981' : (report ? '#6366f1' : '#1e293b'),
            color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px',
            fontWeight: 600, fontSize: 14, cursor: report ? 'pointer' : 'not-allowed',
            opacity: report ? 1 : 0.5, transition: 'background 0.2s',
          }}
        >
          {exported ? '✅ Exported!' : '⬇ Export JSON'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', color: '#fca5a5', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>Generating report...</div>}

      {!loading && !report && !error && (
        <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No report available</div>
        </div>
      )}

      {report && (
        <>
          {/* Header Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={card}>
              <div style={label}>Health Score</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: healthColor(report.healthScore || 0) }}>{report.healthScore ?? '—'}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>out of 100</div>
            </div>
            <div style={card}>
              <div style={label}>Total Storage</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{formatBytes(report.totalBytes)}</div>
            </div>
            <div style={card}>
              <div style={label}>Total Files</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{report.totalFiles?.toLocaleString()}</div>
            </div>
            <div style={card}>
              <div style={label}>Duplicate Waste</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b' }}>{formatBytes(report.totalDuplicateBytes || 0)}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{report.duplicateGroupCount || 0} groups</div>
            </div>
          </div>

          {/* Allocations Table */}
          {report.allocations && report.allocations.length > 0 && (
            <div style={{ ...card, marginBottom: 24 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#fff', marginBottom: 16 }}>Storage Allocations</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Category', 'Files', 'Total Size', 'Share'].map(h => (
                      <th key={h} style={{ textAlign: 'left' as const, padding: '8px 12px', fontSize: 11, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 1, borderBottom: '1px solid #1e293b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.allocations.sort((a: StorageAllocation, b: StorageAllocation) => b.totalBytes - a.totalBytes).map((alloc: StorageAllocation, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #0f172a' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{alloc.category}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#94a3b8' }}>{alloc.fileCount?.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{formatBytes(alloc.totalBytes)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
                            <div style={{ width: `${alloc.percentage || 0}%`, height: '100%', background: '#6366f1', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, color: '#64748b', width: 36, textAlign: 'right' as const }}>{(alloc.percentage || 0).toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations && report.recommendations.length > 0 && (
            <div style={card}>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#fff', marginBottom: 16 }}>Recommendations ({report.recommendations.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                {report.recommendations.map((rec) => (
                  <div key={rec.id} style={{ background: '#060B18', border: '1px solid #1e293b', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>{rec.title}</span>
                          <span style={{ fontSize: 11, color: riskColor(rec.riskLevel), background: `${riskColor(rec.riskLevel)}22`, padding: '1px 8px', borderRadius: 4 }}>{rec.riskLevel}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{rec.description}</div>
                        {rec.paths && rec.paths.length > 0 && (
                          <div style={{ marginTop: 6, fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
                            {rec.paths.slice(0, 3).map((p, i) => <div key={i}>{p}</div>)}
                            {rec.paths.length > 3 && <div>+{rec.paths.length - 3} more paths</div>}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>{formatBytes(rec.estimatedBytes)}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>estimated</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}