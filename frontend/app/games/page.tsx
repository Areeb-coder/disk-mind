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

interface GameItem {
  platform: string;
  name: string;
  path: string;
  size_bytes: number;
}

const platformMeta: Record<string, { icon: string; color: string }> = {
  steam: { icon: '🎮', color: '#1b2838' },
  epic: { icon: '🎯', color: '#0078f2' },
  gog: { icon: '🌌', color: '#8e44ad' },
  xbox: { icon: '🟢', color: '#107c10' },
  origin: { icon: '🧡', color: '#f56c2d' },
  ubisoft: { icon: '🔷', color: '#0070f3' },
  battlenet: { icon: '⚔️', color: '#148eff' },
  default: { icon: '🕹️', color: '#6366f1' },
};

export default function GamesPage() {
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSessions().then((data: ScanSession[]) => {
      const completed = data.filter(s => s.status === 'completed');
      setSessions(completed);
      if (completed.length > 0) {
        const latest = completed[0];
        setSessionId(latest.id);
        loadGames(latest.id);
      }
    }).catch(() => {});
  }, []);

  async function loadGames(id: string) {
    setLoading(true);
    setError('');
    setGames([]);
    try {
      const data = await api.getGaming(id);
      setGames(Array.isArray(data) ? data : (data.games || data.items || []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load gaming data');
    } finally {
      setLoading(false);
    }
  }

  function handleSessionChange(id: string) {
    setSessionId(id);
    loadGames(id);
  }

  // Group by platform
  const grouped: Record<string, GameItem[]> = {};
  games.forEach(g => {
    const key = g.platform || 'default';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(g);
  });

  const totalBytes = games.reduce((s, g) => s + (g.size_bytes || 0), 0);

  return (
    <div style={{ padding: 32, background: '#060B18', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Gaming Storage</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Detect games from Steam, Epic, GOG, Xbox, and more.</p>

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

      {!loading && games.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <div style={card}>
            <div style={label}>Total Gaming Storage</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{formatBytes(totalBytes)}</div>
          </div>
          <div style={card}>
            <div style={label}>Games Found</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{games.length}</div>
          </div>
          <div style={card}>
            <div style={label}>Platforms</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{Object.keys(grouped).length}</div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', color: '#fca5a5', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>Detecting games...</div>}

      {!loading && games.length === 0 && !error && (
        <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎮</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No games detected</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>No recognized gaming launchers or game folders found in this scan.</div>
        </div>
      )}

      {Object.entries(grouped).sort((a, b) =>
        b[1].reduce((s, g) => s + g.size_bytes, 0) - a[1].reduce((s, g) => s + g.size_bytes, 0)
      ).map(([platform, items]) => {
        const meta = platformMeta[platform.toLowerCase()] || platformMeta.default;
        const platformBytes = items.reduce((s, g) => s + (g.size_bytes || 0), 0);
        return (
          <div key={platform} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>{meta.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#e2e8f0' }}>{platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
              <span style={{ color: '#64748b', fontSize: 13 }}>{items.length} game{items.length > 1 ? 's' : ''} — {formatBytes(platformBytes)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {items.sort((a, b) => b.size_bytes - a.size_bytes).map((game, idx) => (
                <div key={idx} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
                  <div style={{ fontSize: 28, flexShrink: 0 }}>{meta.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{game.name}</div>
                    <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{game.path}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b', flexShrink: 0 }}>{formatBytes(game.size_bytes)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}