'use client';
import React, { useState, useEffect } from 'react';
import { api, formatBytes } from '../../lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const card = {
  background: '#0A1628',
  border: '1px solid #1e293b',
  borderRadius: 12,
  padding: '20px 24px',
} as React.CSSProperties;

const label = { fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 1 };

interface TrendPoint {
  date: string;
  totalBytes: number;
  sessionId: string;
}

interface TrendData {
  points: TrendPoint[];
  diskTotalBytes?: number;
}

function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export default function TrendsPage() {
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.getTrends()
      .then((data: TrendData) => setTrendData(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load trends'))
      .finally(() => setLoading(false));
  }, []);

  const points = trendData?.points || [];
  const diskTotal = trendData?.diskTotalBytes || 0;

  // Build chart data
  const chartData = points.map((p, i) => ({
    label: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    bytes: p.totalBytes,
    index: i,
  }));

  // Linear regression
  const regPoints = chartData.map(d => ({ x: d.index, y: d.bytes }));
  const reg = linearRegression(regPoints);

  // Forecast: when does y reach 85% of disk total?
  let daysTo85: number | null = null;
  let forecast85Bytes: number | null = null;
  let growthRateBytesPerDay: number | null = null;

  if (reg && points.length >= 2) {
    const firstDate = new Date(points[0].date).getTime();
    const lastDate = new Date(points[points.length - 1].date).getTime();
    const totalDays = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
    const totalSteps = points.length - 1;
    const daysPerStep = totalDays / Math.max(totalSteps, 1);
    growthRateBytesPerDay = reg.slope / daysPerStep;

    if (diskTotal > 0) {
      const target = diskTotal * 0.85;
      const currentBytes = points[points.length - 1].totalBytes;
      if (growthRateBytesPerDay > 0 && currentBytes < target) {
        daysTo85 = Math.ceil((target - currentBytes) / growthRateBytesPerDay);
        forecast85Bytes = target;
      }
    }
  }

  // Extend chart with forecast line
  const forecastData = [...chartData];
  if (reg && daysTo85 !== null) {
    for (let i = 1; i <= Math.min(5, Math.ceil(daysTo85 / 7)); i++) {
      forecastData.push({
        label: `+${i * (Math.ceil(daysTo85 / 5))}d`,
        bytes: reg.intercept + reg.slope * (chartData.length - 1 + i),
        index: chartData.length - 1 + i,
      });
    }
  }

  const currentBytes = points.length > 0 ? points[points.length - 1].totalBytes : 0;

  return (
    <div style={{ padding: 32, background: '#060B18', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Trends & Forecasts</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Storage growth over time and predictive forecasting.</p>

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', color: '#fca5a5', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>Loading trends...</div>}

      {!loading && points.length === 0 && !error && (
        <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Not enough data for trends</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Run multiple scans over time to see growth trends.</div>
        </div>
      )}

      {!loading && points.length > 0 && (
        <>
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={card}>
              <div style={label}>Current Size</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{formatBytes(currentBytes)}</div>
            </div>
            <div style={card}>
              <div style={label}>Growth Rate</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: growthRateBytesPerDay && growthRateBytesPerDay > 0 ? '#f59e0b' : '#10b981' }}>
                {growthRateBytesPerDay !== null ? `${formatBytes(Math.abs(growthRateBytesPerDay))}/day` : 'N/A'}
              </div>
            </div>
            <div style={card}>
              <div style={label}>Days to 85% Full</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: daysTo85 !== null ? (daysTo85 < 30 ? '#ef4444' : daysTo85 < 90 ? '#f59e0b' : '#10b981') : '#475569' }}>
                {daysTo85 !== null ? `${daysTo85}d` : '—'}
              </div>
            </div>
            <div style={card}>
              <div style={label}>Scan Sessions</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{points.length}</div>
            </div>
          </div>

          {/* Chart */}
          <div style={{ ...card, marginBottom: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#fff', marginBottom: 20 }}>Storage Growth Over Time</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={forecastData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tickFormatter={(v: number) => formatBytes(v)} tick={{ fill: '#64748b', fontSize: 11 }} width={80} />
                <Tooltip
                  formatter={(v: number) => [formatBytes(v), 'Storage Used']}
                  contentStyle={{ background: '#0A1628', border: '1px solid #1e293b', borderRadius: 8 }}
                />
                {forecast85Bytes && diskTotal > 0 && (
                  <ReferenceLine y={forecast85Bytes} stroke="#ef4444" strokeDasharray="5 5" label={{ value: '85% Threshold', fill: '#ef4444', fontSize: 11 }} />
                )}
                <Line
                  type="monotone" dataKey="bytes"
                  stroke="#6366f1" strokeWidth={2.5}
                  dot={{ fill: '#6366f1', r: 4 }}
                  activeDot={{ r: 6, fill: '#818cf8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast Detail */}
          {daysTo85 !== null && (
            <div style={{ ...card, background: daysTo85 < 30 ? '#1a0000' : '#0A1628', borderColor: daysTo85 < 30 ? '#ef4444' : '#1e293b' }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#fff', marginBottom: 12 }}>📊 Forecast Summary</div>
              <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.8 }}>
                Based on {points.length} scan sessions, your storage is growing at approximately{' '}
                <strong style={{ color: '#f59e0b' }}>{growthRateBytesPerDay !== null ? formatBytes(growthRateBytesPerDay) : 'N/A'}</strong> per day.
                {daysTo85 !== null && (
                  <>
                    {' '}At this rate, you will reach{' '}
                    <strong style={{ color: '#ef4444' }}>85% capacity</strong>{' '}
                    in approximately <strong style={{ color: daysTo85 < 30 ? '#ef4444' : '#f59e0b' }}>{daysTo85} days</strong>{' '}
                    ({new Date(Date.now() + daysTo85 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}).
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}