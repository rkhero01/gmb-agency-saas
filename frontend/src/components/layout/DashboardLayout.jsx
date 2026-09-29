import React from 'react';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';

export function DashboardLayout({
  children,
  health,
  isRefreshingHealth,
  onRefreshHealth,
  currentAgency,
}) {
  return (
    <div className="app-container">
      <Sidebar currentAgency={currentAgency} />
      <div className="main-content">
        <Topbar
          health={health}
          isRefreshingHealth={isRefreshingHealth}
          onRefreshHealth={onRefreshHealth}
        />
        <main className="content-body">{children}</main>
      </div>
    </div>
  );
}
