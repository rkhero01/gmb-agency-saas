import React from 'react';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '📊', active: true },
  { id: 'clients', label: 'Clients', icon: '🏢', isFuture: true },
  { id: 'locations', label: 'Locations', icon: '📍', isFuture: true },
  { id: 'gbp', label: 'Google Profiles', icon: '🌐', isFuture: true },
  { id: 'reviews', label: 'Reviews & Replies', icon: '⭐', isFuture: true },
  { id: 'posts', label: 'Post Scheduling', icon: '📅', isFuture: true },
  { id: 'analytics', label: 'Analytics & Reports', icon: '📈', isFuture: true },
  { id: 'settings', label: 'Agency Settings', icon: '⚙️', isFuture: true },
];

export function Sidebar({ currentAgency = { name: 'Acme Digital Agency', tier: 'Enterprise' } }) {
  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="brand-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="brand-title">GMB SaaS</span>
        <span className="brand-tag">v0.1</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-title">Navigation</div>
        {NAV_ITEMS.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${item.active ? 'active' : ''}`}
            title={item.isFuture ? `${item.label} (Planned Phase)` : item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.isFuture && <span className="badge-future">Phase 1+</span>}
          </div>
        ))}
      </nav>

      {/* Tenant Pill in Sidebar Footer */}
      <div className="sidebar-footer">
        <div className="tenant-pill">
          <span className="tenant-label">Current Tenant Workspace</span>
          <div className="tenant-name">
            <span>{currentAgency.name}</span>
            <span style={{ fontSize: '0.65rem', color: '#10b981' }}>Active</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
