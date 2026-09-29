import React from 'react';

export function Topbar({ health, isRefreshingHealth, onRefreshHealth }) {
  const isHealthy = health?.status === 'healthy';
  const hasError = !health && !isRefreshingHealth;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="page-title">Agency Command Center</h1>
        <div className="phase-indicator">
          <span style={{ fontSize: '0.65rem' }}>●</span>
          <span>Phase 0: Foundation</span>
        </div>
      </div>

      <div className="topbar-right">
        {/* API Health Check Status Badge */}
        <div
          className={`health-badge ${
            isRefreshingHealth ? 'checking' : isHealthy ? 'healthy' : 'error'
          }`}
          title="Live REST API backend health status"
        >
          <span className={`pulse-dot ${isHealthy ? 'pulsing' : ''}`}></span>
          <span>
            {isRefreshingHealth
              ? 'Checking API...'
              : isHealthy
              ? `API Online (Uptime: ${health?.data?.uptimeSeconds ?? 0}s)`
              : 'API Offline'}
          </span>
          <button
            onClick={onRefreshHealth}
            disabled={isRefreshingHealth}
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 6, padding: '2px 8px', fontSize: '0.7rem' }}
            title="Recheck API health"
          >
            ↻
          </button>
        </div>

        {/* Agency Profile Avatar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 12px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-full)',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            AD
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Agency Owner</span>
        </div>
      </div>
    </header>
  );
}
