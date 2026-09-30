import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from './components/layout/DashboardLayout.jsx';
import { OverviewStats } from './components/dashboard/OverviewStats.jsx';
import { TenantHealthWidget } from './components/dashboard/TenantHealthWidget.jsx';
import { HierarchyPreview } from './components/dashboard/HierarchyPreview.jsx';
import { TeamManagementView } from './components/team/TeamManagementView.jsx';
import { ClientManagementView } from './components/client/ClientManagementView.jsx';
import { LocationManagementView } from './components/location/LocationManagementView.jsx';
import { GoogleConnectionView } from './components/google/GoogleConnectionView.jsx';
import { LoginView } from './components/auth/LoginView.jsx';
import {
  getBackendHealth,
  getMe,
  logout,
  getStoredToken,
} from './services/api.js';

export function App() {
  const [health, setHealth] = useState(null);
  const [isRefreshingHealth, setIsRefreshingHealth] = useState(false);
  const [healthError, setHealthError] = useState(null);

  // Authentication State
  const [authToken, setAuthToken] = useState(getStoredToken());
  const [currentUser, setCurrentUser] = useState(null);
  const [currentAgency, setCurrentAgency] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // View Navigation: 'overview' | 'team' | 'clients' | 'locations' | 'gbp'
  const [currentView, setCurrentView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'overview';
  });
  const [selectedClient, setSelectedClient] = useState(null);

  // Health Check Fetcher
  const fetchHealth = useCallback(async () => {
    setIsRefreshingHealth(true);
    setHealthError(null);
    try {
      const data = await getBackendHealth();
      setHealth(data);
    } catch (err) {
      console.error('Failed to load health check:', err);
      setHealthError(err);
      setHealth(null);
    } finally {
      setIsRefreshingHealth(false);
    }
  }, []);

  // Initial Auth Check
  const checkAuth = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setCurrentUser(null);
      setCurrentAgency(null);
      setAuthChecking(false);
      return;
    }

    try {
      const data = await getMe();
      setCurrentUser(data.user);
      setCurrentAgency(data.agency);
    } catch (err) {
      console.warn('Session expired or invalid:', err.message);
      setCurrentUser(null);
      setCurrentAgency(null);
      setAuthToken(null);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    checkAuth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth, checkAuth]);

  // Login handler
  const handleLoginSuccess = (user, agency) => {
    setCurrentUser(user);
    setCurrentAgency(agency);
    setAuthToken(getStoredToken());
    setCurrentView('overview');
  };

  // Logout handler
  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setCurrentAgency(null);
    setAuthToken(null);
    setCurrentView('overview');
  };

  // Loading state while checking session
  if (authChecking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
        }}
      >
        Initializing secure agency workspace...
      </div>
    );
  }

  // If not authenticated, render Login Screen
  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        backendHealth={health}
      />
    );
  }

  return (
    <DashboardLayout
      health={health}
      isRefreshingHealth={isRefreshingHealth}
      onRefreshHealth={fetchHealth}
      currentAgency={currentAgency}
      currentUser={currentUser}
      onLogout={handleLogout}
      currentView={currentView}
      onSelectView={setCurrentView}
    >
      {currentView === 'overview' && (
        <>
          {/* Welcome Banner */}
          <section className="welcome-banner">
            <h2 className="welcome-title">
              Welcome back, {currentUser.name}!
            </h2>
            <p className="welcome-desc">
              Logged into <strong style={{ color: '#ffffff' }}>{currentAgency?.name}</strong> with{' '}
              <span
                style={{
                  color: 'var(--primary)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {currentUser.role}
              </span>{' '}
              privileges. Phase 2 Authentication & Team RBAC is active.
            </p>
          </section>

          {/* Overview Metric Cards */}
          <OverviewStats />

          {/* System Diagnostics & Domain Hierarchy */}
          <div className="panels-grid">
            <TenantHealthWidget
              health={health}
              error={healthError}
              onRetry={fetchHealth}
              isRefreshing={isRefreshingHealth}
            />
            <HierarchyPreview />
          </div>

          {/* Planned Modules Roadmap Table */}
          <div className="panel-card">
            <div className="panel-title">
              <span>🚀</span>
              <span>Architectural Phases & Module Readiness</span>
            </div>
            <p className="panel-desc">
              Strict separation of concerns. Subsequent modules will unlock on approval.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px', color: 'var(--text-subtle)' }}>Phase</th>
                    <th style={{ padding: '12px 14px', color: 'var(--text-subtle)' }}>Module</th>
                    <th style={{ padding: '12px 14px', color: 'var(--text-subtle)' }}>Scope & Description</th>
                    <th style={{ padding: '12px 14px', color: 'var(--text-subtle)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono', color: '#6366f1' }}>Phase 0</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Project Foundation</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                      Repository structure, Express REST API, health endpoint & Vite SPA shell
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: 4 }}>
                        ✓ Completed
                      </span>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono', color: '#6366f1' }}>Phase 1</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Database & Core Entities</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                      PostgreSQL migrations, compound foreign-key isolation, Agency/Client/Location repositories
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: 4 }}>
                        ✓ Completed
                      </span>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono', color: '#6366f1' }}>Phase 2</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Auth & Team RBAC</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                      JWT authentication, bcrypt hashing, 5 team roles, final owner protection & team governance
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: 4 }}>
                        ✓ Completed
                      </span>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono', color: '#6366f1' }}>Phase 3</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Client & Location CRUD</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                      Brand portfolio management, branch address management, category assignment
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: 4 }}>
                        ✓ Completed
                      </span>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono', color: '#6366f1' }}>Phase 4</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Google OAuth & GBP API</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                      Google Cloud OAuth 2.0 authorization-code flow, multi-tenant token isolation, Business Profile location linking
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: 4 }}>
                        ✓ Completed
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono', color: 'var(--text-subtle)' }}>Phase 5+</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Reviews & AI Replies</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                      Review synchronization, sentiment analysis, AI automated reply generation & approval flows
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Future</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {currentView === 'team' && (
        <TeamManagementView
          currentUser={currentUser}
          currentAgency={currentAgency}
        />
      )}

      {currentView === 'clients' && (
        <ClientManagementView
          currentUser={currentUser}
          currentAgency={currentAgency}
          onSelectClient={(client) => {
            setSelectedClient(client);
            setCurrentView('locations');
          }}
        />
      )}

      {currentView === 'locations' && (
        <LocationManagementView
          currentUser={currentUser}
          currentAgency={currentAgency}
          initialClient={selectedClient}
          onBackToClients={() => setCurrentView('clients')}
        />
      )}

      {currentView === 'gbp' && (
        <GoogleConnectionView
          currentUser={currentUser}
          currentAgency={currentAgency}
        />
      )}
    </DashboardLayout>
  );
}

export default App;
