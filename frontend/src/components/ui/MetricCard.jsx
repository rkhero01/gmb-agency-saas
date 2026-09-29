import React from 'react';

export function MetricCard({ label, value, note, icon, tag }) {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        {icon && <div className="metric-icon-wrap">{icon}</div>}
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-footer">
        {tag && (
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#818cf8',
            }}
          >
            {tag}
          </span>
        )}
        <span>{note}</span>
      </div>
    </div>
  );
}
