import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from './components/layout/DashboardLayout.jsx';
import { OverviewStats } from './components/dashboard/OverviewStats.jsx';
import { TenantHealthWidget } from './components/dashboard/TenantHealthWidget.jsx';
import { HierarchyPreview } from './components/dashboard/HierarchyPreview.jsx';
import { getBackendHealth } from './services/api.js';

export function App() {
  const [health, setHealth] = useState(null);
  const [isRefreshingHealth, setIsRefreshingHealth] = useState(false);
  const [error, setError] = useState(null);

  const fetchHealth = useCallback(async () => {
    setIsRefreshingHealth(true);
    setError(null);
    try {
      const data = await getBackendHealth();
      setHealth(data);
    } catch (err) {
      console.error('Failed to load health check:', err);
      setError(err);
      setHealth(null);
    } finally {
      setIsRefreshingHealth(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Periodic health refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const currentAgency = {
    name: 'Apex Growth Marketing LLC',
    slug: 'apex-growth',
    tier: 'Agency Pro',
  };

  return (
    <DashboardLayout
      health={health}
      isRefreshingHealth={isRefreshingHealth}
      onRefreshHealth={fetchHealth}
      currentAgency={currentAgency}
    >
      {/* Welcome Banner */}
      <section className="welcome-banner">
        <h2 className="welcome-title">Welcome to GMB Agency SaaS</h2>
        <p className="welcome-desc">
          Phase 0 Foundation initialized. The multi-tenant architecture is configured with strict
          agency isolation, Node.js REST API with health monitoring, PostgreSQL relational schema,
          and a modular foundation prepared for future Google Business Profile workflows.
        </p>
      </section>

      {/* Overview Metric Cards */}
      <OverviewStats />

      {/* System Diagnostics & Domain Hierarchy */}
      <div className="panels-grid">
        <TenantHealthWidget
          health={health}
          error={error}
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
                  Repository structure, Express REST API, health endpoint, PostgreSQL DDL & Vite SPA shell
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: 4 }}>
                    ✓ Completed
                  </span>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono', color: 'var(--text-subtle)' }}>Phase 1</td>
                <td style={{ padding: '12px 14px', fontWeight: 600 }}>Database & Core Entities</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                  PostgreSQL migration runner, Agency & User repositories, RLS session configuration
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Queued</span>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono', color: 'var(--text-subtle)' }}>Phase 2</td>
                <td style={{ padding: '12px 14px', fontWeight: 600 }}>Auth & Team RBAC</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                  JWT auth, password security, Owner/Admin/Manager/Member permissions
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Planned</span>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono', color: 'var(--text-subtle)' }}>Phase 3</td>
                <td style={{ padding: '12px 14px', fontWeight: 600 }}>Client & Location CRUD</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                  Brand portfolio management, branch address management, category assignment
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Planned</span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono', color: 'var(--text-subtle)' }}>Phase 4+</td>
                <td style={{ padding: '12px 14px', fontWeight: 600 }}>Google OAuth & GBP API</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                  Google API integration, review management, post scheduler & client reporting
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Future</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default App;
