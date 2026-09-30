import React from 'react';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'team', label: 'Team & RBAC', icon: '👥', tag: 'Phase 2' },
  { id: 'clients', label: 'Clients', icon: '🏢', tag: 'Phase 3' },
  { id: 'locations', label: 'Locations', icon: '📍', tag: 'Phase 3' },
  { id: 'gbp', label: 'Google Profiles', icon: '🌐', tag: 'Phase 4' },
  { id: 'reviews', label: 'Reviews & Replies', icon: '⭐', isFuture: true, tag: 'Phase 5' },
  { id: 'posts', label: 'Post Scheduling', icon: '📅', isFuture: true, tag: 'Phase 6' },
  { id: 'analytics', label: 'Analytics & Reports', icon: '📈', isFuture: true, tag: 'Phase 7' },
];

export function Sidebar({
  currentView = 'overview',
  onSelectView,
  currentAgency = { name: 'Acme Digital Agency' },
}) {
  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="brand-icon">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="brand-title">GMB SaaS</span>
        <span className="brand-tag">v0.4</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-title">Navigation</div>
        {NAV_ITEMS.map((item) => {
          const isActive = currentView === item.id;
          return (
            <div
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                if (!item.isFuture && onSelectView) {
                  onSelectView(item.id);
                }
              }}
              style={{
                cursor: item.isFuture ? 'not-allowed' : 'pointer',
                opacity: item.isFuture ? 0.6 : 1,
              }}
              title={item.isFuture ? `${item.label} (Planned ${item.tag})` : item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.tag && (
                <span
                  className="badge-future"
                  style={{
                    backgroundColor: ['team', 'clients', 'locations', 'gbp'].includes(item.id)
                      ? 'rgba(99, 102, 241, 0.2)'
                      : undefined,
                    color: ['team', 'clients', 'locations', 'gbp'].includes(item.id)
                      ? '#a5b4fc'
                      : undefined,
                  }}
                >
                  {item.tag}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {/* Tenant Pill in Sidebar Footer */}
      <div className="sidebar-footer">
        <div className="tenant-pill">
          <span className="tenant-label">Current Tenant Workspace</span>
          <div className="tenant-name">
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentAgency?.name || 'Default Agency'}
            </span>
            <span style={{ fontSize: '0.65rem', color: '#10b981' }}>Active</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
