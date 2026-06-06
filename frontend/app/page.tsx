'use client';
import React, { useState, useEffect, useRef } from 'react';
import { api, formatBytes } from '../lib/api';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { ScanStatus, IntelligenceReport, StorageAllocation } from '../lib/types';

const COLORS = ['#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const card = {
  background: '#0A1628',
  border: '1px solid #1e293b',
  borderRadius: 12,
  padding: '20px 24px',
} as React.CSSProperties;

const label = { fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 1 };
const bigNum = { fontSize: 32, fontWeight: 700, color: '#fff' };

function HealthRing({ score }: { score: number }) {
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const progress = circ - (score / 100) * circ;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ position: 'relative', width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={130} height={130} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx={65} cy={65} r={radius} fill="none" stroke="#1e293b" strokeWidth={10} />
        <circle
          cx={65} cy={65} r={radius} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={progress}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color }}>{score}</div>
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>HEALTH</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [scanPath, setScanPath] = useState('C:\\');
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initDashboard();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function initDashboard() {
    try {
      // Check if a scan is already running
      const status = await api.getScanStatus();
      if (status.isRunning) {
        setScanning(true);
        setScanStatus(status);
        // Auto-attach polling to the running scan
        attachPoller();
        return;
      }
    } catch {
      // backend not reachable yet, ignore
    }
    // Load latest completed session
    await loadLatestSession();
  }

  function attachPoller() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.getScanStatus();
        setScanStatus(status);
        if (!status.isRunning) {
          clearInterval(pollRef.current!);
          setScanning(false);
          if (status.sessionId) {
            try {
              const r = await api.getReport(status.sessionId);
              setReport(r);
            } catch {
              setError('Scan completed but failed to load report.');
            }
          } else {
            await loadLatestSession();
          }
        }
      } catch {
        clearInterval(pollRef.current!);
        setScanning(false);
      }
    }, 2000);
  }

  async function loadLatestSession() {
    try {
      const sessions = await api.getSessions();
      if (sessions && sessions.length > 0) {
        const completed = sessions.filter((s: { status: string }) => s.status === 'completed');
        if (completed.length > 0) {
          const latest = completed[completed.length - 1];
          const r = await api.getReport(latest.id);
          setReport(r);
        }
      }
    } catch {
      // no sessions yet
    }
  }

  async function handleStartScan() {
    setError('');
    setReport(null);
    setScanning(true);
    setScanStatus(null);
    try {
      await api.startScan(scanPath);
      attachPoller();
    } catch (e: unknown) {
      // If already running, just attach to the existing scan
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('already running')) {
        attachPoller();
      } else {
        setScanning(false);
        setError(msg || 'Failed to start scan');
      }
    }
  }

  async function handleStopScan() {
    try {
      await api.stopScan();
    } catch {
      // ignore
    }
    if (pollRef.current) clearInterval(pollRef.current);
    setScanning(false);
  }

  const riskColor = (r: string) => {
    if (r === 'Safe') return '#10b981';
    if (r === 'Moderate') return '#f59e0b';
    if (r === 'Caution') return '#ef4444';
    return '#94a3b8';
  };

  const pieData = report?.allocations?.map((a: StorageAllocation) => ({
    name: a.category,
    value: a.totalBytes,
  })) || [];

  return (
    <div style={{ padding: 32, minHeight: '100vh', background: '#060B18' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Storage Intelligence Overview</h1>
        <p style={{ color: '#64748b', fontSize: 14 }}>Scan your drive and get actionable insights about your storage.</p>
      </div>

      {/* Scan Control */}
      <div style={{ ...card, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={label}>Scan Path</div>
          <input
            value={scanPath}
            onChange={e => setScanPath(e.target.value)}
            disabled={scanning}
            style={{
              background: '#060B18', border: '1px solid #334155', borderRadius: 8,
              color: '#e2e8f0', padding: '8px 12px', fontSize: 14, width: '100%', outline: 'none',
            }}
            placeholder="e.g. C:\"
          />
        </div>
        {!scanning ? (
          <button
            onClick={handleStartScan}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #3b82f6)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              marginTop: 16, whiteSpace: 'nowrap' as const,
            }}
          >
            ▶ Start Scan
          </button>
        ) : (
          <button
            onClick={handleStopScan}
            style={{
              background: '#ef4444', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              marginTop: 16, whiteSpace: 'nowrap' as const,
            }}
          >
            ■ Stop Scan
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', color: '#fca5a5', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Scan Progress */}
      {scanning && scanStatus && (
        <div style={{ ...card, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1', animation: 'pulse 1s infinite' }} />
            <span style={{ color: '#6366f1', fontWeight: 600, fontSize: 14 }}>Scanning in progress...</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={label}>Files Scanned</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{scanStatus.filesScanned?.toLocaleString()}</div>
            </div>
            <div>
              <div style={label}>Folders Scanned</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{scanStatus.foldersScanned?.toLocaleString()}</div>
            </div>
            <div>
              <div style={label}>Bytes Scanned</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{formatBytes(scanStatus.bytesScanned || 0)}</div>
            </div>
          </div>
          {/* Progress Completion Bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
              <span>Progress</span>
              <span>
                {scanStatus.totalDiskBytes > 0 
                  ? `${((scanStatus.bytesScanned / scanStatus.totalDiskBytes) * 100).toFixed(1)}%` 
                  : '0.0%'} 
                {scanStatus.totalDiskBytes > 0 && ` (${formatBytes(scanStatus.bytesScanned || 0)} / ${formatBytes(scanStatus.totalDiskBytes)})`}
              </span>
            </div>
            <div style={{ height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, #6366f1, #3b82f6)',
                width: `${scanStatus.totalDiskBytes > 0 ? Math.min(100, (scanStatus.bytesScanned / scanStatus.totalDiskBytes) * 100) : 0}%`,
                transition: 'width 0.3s ease-out',
              }} />
            </div>
          </div>
          {scanStatus.currentFile && (
            <div style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              📄 {scanStatus.currentFile}
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      {report && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={card}>
              <div style={label}>Total Used</div>
              <div style={bigNum}>{formatBytes(report.totalBytes)}</div>
            </div>
            <div style={card}>
              <div style={label}>Total Files</div>
              <div style={bigNum}>{report.totalFiles?.toLocaleString()}</div>
            </div>
            <div style={card}>
              <div style={label}>Duplicate Waste</div>
              <div style={{ ...bigNum, color: report.totalDuplicateBytes > 0 ? '#f59e0b' : '#10b981' }}>
                {formatBytes(report.totalDuplicateBytes || 0)}
              </div>
            </div>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
              <HealthRing score={report.healthScore || 0} />
              <div>
                <div style={label}>Health Score</div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>
                  {(report.healthScore || 0) >= 80 ? 'Excellent' : (report.healthScore || 0) >= 60 ? 'Fair' : 'Poor'}
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                  {report.duplicateGroupCount || 0} duplicate groups
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            {/* Pie Chart */}
            <div style={card}>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#fff', marginBottom: 16 }}>Storage by Category</div>
              {pieData.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                        {pieData.map((_: unknown, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBytes(v)} contentStyle={{ background: '#0A1628', border: '1px solid #1e293b', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1 }}>
                    {pieData.slice(0, 7).map((d: { name: string; value: number }, i: number) => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{d.name}</span>
                        <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{formatBytes(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ color: '#475569', fontSize: 13, textAlign: 'center' as const, padding: 40 }}>No allocation data</div>
              )}
            </div>

            {/* Bar Chart */}
            <div style={card}>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#fff', marginBottom: 16 }}>Top Categories by Size</div>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={pieData.slice(0, 8)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis tickFormatter={(v: number) => formatBytes(v)} tick={{ fill: '#64748b', fontSize: 10 }} width={60} />
                    <Tooltip formatter={(v: number) => formatBytes(v)} contentStyle={{ background: '#0A1628', border: '1px solid #1e293b', borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {pieData.slice(0, 8).map((_: unknown, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ color: '#475569', fontSize: 13, textAlign: 'center' as const, padding: 40 }}>No data</div>
              )}
            </div>
          </div>

          {/* Recommendations */}
          {report.recommendations && report.recommendations.length > 0 && (
            <div style={card}>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#fff', marginBottom: 16 }}>Top Recommendations</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                {report.recommendations.slice(0, 5).map((rec) => (
                  <div key={rec.id} style={{ background: '#060B18', border: '1px solid #1e293b', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: riskColor(rec.riskLevel), flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>{rec.title}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{rec.description}</div>
                    </div>
                    <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>{formatBytes(rec.estimatedBytes)}</div>
                      <div style={{ fontSize: 11, color: riskColor(rec.riskLevel), marginTop: 2 }}>{rec.riskLevel}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!report && !scanning && (
        <div style={{ textAlign: 'center' as const, padding: '60px 0', color: '#334155' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#475569' }}>No scan data yet</div>
          <div style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>Enter a path above and start a scan to see storage analytics.</div>
        </div>
      )}
    </div>
  );
}
