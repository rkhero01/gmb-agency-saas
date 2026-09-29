import React from 'react';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';

export function DashboardLayout({
  children,
  health,
  isRefreshingHealth,
  onRefreshHealth,
  currentAgency,
  currentUser,
  onLogout,
  currentView,
  onSelectView,
}) {
  return (
    <div className="app-container">
      <Sidebar
        currentAgency={currentAgency}
        currentView={currentView}
        onSelectView={onSelectView}
      />
      <div className="main-content">
        <Topbar
          health={health}
          isRefreshingHealth={isRefreshingHealth}
          onRefreshHealth={onRefreshHealth}
          currentUser={currentUser}
          onLogout={onLogout}
        />
        <main className="content-body">{children}</main>
      </div>
    </div>
  );
}
