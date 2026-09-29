import React from 'react';

export function StatusBadge({ status, text }) {
  const getStyles = () => {
    switch (status) {
      case 'healthy':
      case 'active':
      case 'connected':
        return {
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#6ee7b7',
        };
      case 'warning':
      case 'pending':
        return {
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          color: '#fcd34d',
        };
      case 'error':
      case 'failed':
      case 'disconnected':
        return {
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
        };
      default:
        return {
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#94a3b8',
        };
    }
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        borderRadius: 'var(--radius-full)',
        fontSize: '0.75rem',
        fontWeight: 600,
        ...getStyles(),
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: 'currentColor',
        }}
      />
      {text || status}
    </span>
  );
}
