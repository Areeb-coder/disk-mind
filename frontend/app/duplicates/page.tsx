'use client';
import React, { useState, useEffect } from 'react';
import { api, formatBytes } from '../../lib/api';
import type { ScanSession, DuplicateGroup } from '../../lib/types';

const card = {
  background: '#0A1628',
  border: '1px solid #1e293b',
  borderRadius: 12,
  padding: '20px 24px',
} as React.CSSProperties;

const label = { fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 1 };

export default function DuplicatesPage() {
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api.getSessions().then((data: ScanSession[]) => {
      const completed = data.filter(s => s.status === 'completed');
      setSessions(completed);
      if (completed.length > 0) {
        const latest = completed[0];
        setSessionId(latest.id);
        loadDuplicates(latest.id);
      }
    }).catch(() => {});
  }, []);

  async function loadDuplicates(id: string) {
    setLoading(true);
    setError('');
    setGroups([]);
    try {
      const data = await api.getDuplicates(id);
      setGroups(Array.isArray(data) ? data : (data.groups || data.duplicates || []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load duplicates');
    } finally {
      setLoading(false);
    }
  }

  function handleSessionChange(id: string) {
    setSessionId(id);
    loadDuplicates(id);
  }

  function copyPath(path: string) {
    navigator.clipboard.writeText(path).then(() => {
      setCopied(path);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const totalWasted = groups.reduce((sum, g) => sum + (g.wastedBytes || 0), 0);

  return (
    <div style={{ padding: 32, background: '#060B18', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Duplicate File Detection</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Find and review duplicate files that are wasting disk space.</p>

      {/* Session Selector */}
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

      {/* Summary Banner */}
      {!loading && groups.length > 0 && (
        <div style={{ ...card, marginBottom: 24, background: totalWasted > 0 ? '#1a0f00' : '#0A1628', borderColor: totalWasted > 0 ? '#92400e' : '#1e293b', display: 'flex', gap: 32 }}>
          <div>
            <div style={label}>Total Wasted Space</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{formatBytes(totalWasted)}</div>
          </div>
          <div>
            <div style={label}>Duplicate Groups</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{groups.length}</div>
          </div>
          <div>
            <div style={label}>Total Duplicate Files</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{groups.reduce((s, g) => s + g.fileCount, 0)}</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', color: '#fca5a5', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60, fontSize: 14 }}>Scanning for duplicates...</div>
      )}

      {/* Duplicate Groups */}
      {!loading && groups.length === 0 && !error && (
        <div style={{ textAlign: 'center' as const, color: '#475569', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No duplicate files found</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Your storage looks clean!</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
        {groups.map((group, idx) => (
          <div key={group.groupId || idx} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 20 }}>
                <div>
                  <div style={label}>File Size</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{formatBytes(group.fileSizeBytes)}</div>
                </div>
                <div>
                  <div style={label}>Copies</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{group.fileCount}</div>
                </div>
                <div>
                  <div style={label}>Wasted</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{formatBytes(group.wastedBytes)}</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {group.fileHash}
              </div>
            </div>
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: 12, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {group.files?.map((file, fi) => (
                <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#060B18', borderRadius: 6, padding: '8px 12px' }}>
                  <span style={{ fontSize: 13, color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontFamily: 'monospace' }}>
                    {file.full_path}
                  </span>
                  <span style={{ fontSize: 11, color: '#475569', flexShrink: 0 }}>{new Date(file.last_modified).toLocaleDateString()}</span>
                  <button
                    onClick={() => copyPath(file.full_path)}
                    style={{
                      background: copied === file.full_path ? '#10b981' : '#1e293b', color: '#fff',
                      border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: 11,
                      cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s',
                    }}
                  >
                    {copied === file.full_path ? 'Copied!' : 'Copy Path'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
