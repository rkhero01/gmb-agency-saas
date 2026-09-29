import React from 'react';

export function Topbar({
  health,
  isRefreshingHealth,
  onRefreshHealth,
  currentUser,
  onLogout,
}) {
  const isHealthy = health?.status === 'healthy';

  const userInitials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="page-title">Agency Command Center</h1>
        <div className="phase-indicator">
          <span style={{ fontSize: '0.65rem' }}>●</span>
          <span>Phase 2: Auth & Team RBAC</span>
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
              ? `API Online (${health?.data?.uptimeSeconds ?? 0}s)`
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

        {/* User Profile & Role Chip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '4px 10px 4px 6px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-full)',
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
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
            {userInitials}
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.2 }}>
              {currentUser?.name || 'Authenticated User'}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#818cf8', textTransform: 'uppercase', fontWeight: 700 }}>
              {currentUser?.role || 'Member'}
            </div>
          </div>
        </div>

        {/* Logout Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="btn btn-secondary btn-sm"
            title="Sign out of workspace"
            style={{ fontSize: '0.75rem' }}
          >
            Sign Out
          </button>
        )}
      </div>
    </header>
  );
}
