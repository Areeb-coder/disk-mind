'use client';
import React, { useState, useEffect } from 'react';

const card = {
  background: '#0A1628',
  border: '1px solid #1e293b',
  borderRadius: 12,
  padding: '24px 28px',
} as React.CSSProperties;

const inputStyle = {
  background: '#060B18',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#e2e8f0',
  padding: '10px 14px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
} as React.CSSProperties;

const label = { fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 1 };

export default function SettingsPage() {
  const [token, setToken] = useState('');
  const [port, setPort] = useState('5000');
  const [saved, setSaved] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [connMsg, setConnMsg] = useState('');
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('diskmind_token') || '';
    const storedPort = localStorage.getItem('diskmind_port') || '5000';
    setToken(storedToken);
    setPort(storedPort);
  }, []);

  function handleSave() {
    localStorage.setItem('diskmind_token', token);
    localStorage.setItem('diskmind_port', port);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleTestConnection() {
    setConnStatus('testing');
    setConnMsg('');
    try {
      const portNum = parseInt(port) || 5000;
      const res = await fetch(`http://localhost:${portNum}/health`, {
        headers: { 'X-DiskMind-Token': token },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setConnStatus('ok');
        setConnMsg(`Connected! Server version: ${data.version || 'unknown'}`);
      } else {
        setConnStatus('error');
        setConnMsg(`Server responded with ${res.status}: ${res.statusText}`);
      }
    } catch (e: unknown) {
      setConnStatus('error');
      setConnMsg(e instanceof Error ? e.message : 'Connection failed');
    }
  }

  const maskedToken = token ? token.slice(0, 6) + '••••••••' + token.slice(-4) : '(not set)';

  return (
    <div style={{ padding: 32, background: '#060B18', minHeight: '100vh', maxWidth: 720 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Settings</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 32 }}>Configure DiskMind connection settings.</p>

      {/* Connection Settings */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 16, color: '#fff', marginBottom: 20 }}>🔌 Connection</div>

        <div style={{ marginBottom: 20 }}>
          <div style={label}>Backend Port</div>
          <input
            type="number"
            value={port}
            onChange={e => setPort(e.target.value)}
            style={{ ...inputStyle, maxWidth: 200 }}
            placeholder="5000"
            min={1024}
            max={65535}
          />
          <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>Default: 5000. The port the DiskMind backend is running on.</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={label}>Authentication Token</div>
          <div style={{ position: 'relative' as const }}>
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              style={inputStyle}
              placeholder="Paste your token here"
            />
            <button
              onClick={() => setShowToken(v => !v)}
              style={{
                position: 'absolute' as const, right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13,
              }}
            >
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>
            Current: <code style={{ color: '#94a3b8' }}>{maskedToken}</code>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
          <button
            onClick={handleSave}
            style={{
              background: saved ? '#10b981' : 'linear-gradient(135deg, #6366f1, #3b82f6)',
              color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px',
              fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'background 0.2s',
            }}
          >
            {saved ? '✅ Saved!' : '💾 Save Settings'}
          </button>
          <button
            onClick={handleTestConnection}
            disabled={connStatus === 'testing'}
            style={{
              background: connStatus === 'ok' ? '#10b981' : connStatus === 'error' ? '#ef4444' : '#1e293b',
              color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px',
              fontWeight: 600, fontSize: 14, cursor: connStatus === 'testing' ? 'wait' : 'pointer',
              transition: 'background 0.3s',
            }}
          >
            {connStatus === 'testing' ? '⏳ Testing...' : '🔍 Test Connection'}
          </button>
        </div>
      </div>

      {/* Connection Status */}
      {connStatus !== 'idle' && (
        <div style={{
          ...card, marginBottom: 24,
          background: connStatus === 'ok' ? '#052e16' : connStatus === 'error' ? '#450a0a' : '#0A1628',
          borderColor: connStatus === 'ok' ? '#166534' : connStatus === 'error' ? '#7f1d1d' : '#1e293b',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{connStatus === 'ok' ? '✅' : connStatus === 'error' ? '❌' : '⏳'}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: connStatus === 'ok' ? '#4ade80' : connStatus === 'error' ? '#f87171' : '#e2e8f0' }}>
                {connStatus === 'ok' ? 'Connection Successful' : connStatus === 'error' ? 'Connection Failed' : 'Testing...'}
              </div>
              {connMsg && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{connMsg}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div style={card}>
        <div style={{ fontWeight: 600, fontSize: 16, color: '#fff', marginBottom: 16 }}>ℹ️ About</div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {[
            { key: 'Application', value: 'DiskMind Storage Intelligence Platform' },
            { key: 'Token file location', value: '%LOCALAPPDATA%\\DiskMind\\client_token.txt' },
            { key: 'Config source', value: '/public/config.json (auto-generated on start)' },
            { key: 'Settings stored in', value: 'localStorage (browser)' },
          ].map(({ key, value }) => (
            <div key={key} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
              <span style={{ color: '#64748b', minWidth: 160, flexShrink: 0 }}>{key}:</span>
              <span style={{ color: '#94a3b8', fontFamily: key.includes('location') || key.includes('Config') ? 'monospace' : 'inherit' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}