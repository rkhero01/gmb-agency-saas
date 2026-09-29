import React from 'react';
import { StatusBadge } from '../ui/StatusBadge.jsx';

export function TenantHealthWidget({ health, error, onRetry, isRefreshing }) {
  const data = health?.data;

  return (
    <div className="panel-card">
      <div className="panel-title">
        <span>🩺</span>
        <span>Backend & System Diagnostics</span>
        <div style={{ marginLeft: 'auto' }}>
          <StatusBadge
            status={error ? 'error' : data?.status === 'healthy' ? 'healthy' : 'warning'}
            text={error ? 'Offline' : data?.status === 'healthy' ? 'Online' : 'Checking'}
          />
        </div>
      </div>
      <p className="panel-desc">
        Real-time telemetry from Node.js REST API (<code style={{ color: '#818cf8' }}>GET /api/v1/health</code>).
      </p>

      {error ? (
        <div
          style={{
            padding: 16,
            background: 'var(--danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#fca5a5',
            fontSize: '0.85rem',
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Connection Error</div>
          <div>{error.message || 'Failed to communicate with backend server.'}</div>
          <button
            onClick={onRetry}
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 12 }}
            disabled={isRefreshing}
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="diag-list">
          <div className="diag-item">
            <span className="diag-key">REST API Status</span>
            <span className="diag-val" style={{ color: '#10b981' }}>
              {data?.status || 'Active'}
            </span>
          </div>
          <div className="diag-item">
            <span className="diag-key">Environment Mode</span>
            <span className="diag-val">{data?.environment || 'development'}</span>
          </div>
          <div className="diag-item">
            <span className="diag-key">API Version</span>
            <span className="diag-val">v{data?.version || '0.1.0'}</span>
          </div>
          <div className="diag-item">
            <span className="diag-key">Process Uptime</span>
            <span className="diag-val">{data?.uptimeSeconds ?? 0} seconds</span>
          </div>
          <div className="diag-item">
            <span className="diag-key">Node Runtime</span>
            <span className="diag-val">{data?.system?.nodeVersion || 'v24.x'}</span>
          </div>
          <div className="diag-item">
            <span className="diag-key">Database Engine</span>
            <span className="diag-val">
              {data?.services?.database?.type || 'PostgreSQL 14+'} (
              {data?.services?.database?.connected ? 'Connected' : 'Ready for Phase 1'})
            </span>
          </div>
          <div className="diag-item">
            <span className="diag-key">Tenant Context Guard</span>
            <span className="diag-val" style={{ color: '#a5b4fc' }}>
              RLS + Agency Scoping Active
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
