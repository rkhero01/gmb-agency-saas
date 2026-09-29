import React, { useState } from 'react';
import { login, registerAgency } from '../../services/api.js';

export function LoginView({ onLoginSuccess, backendHealth }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [agencySlug, setAgencySlug] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        const data = await registerAgency({
          agencyName,
          agencySlug: agencySlug || agencyName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name,
          email,
          password,
        });
        onLoginSuccess(data.user, data.agency);
      } else {
        const data = await login(email, password);
        onLoginSuccess(data.user, data.agency);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Quick preset helper for testing
  const handleQuickDemoSetup = async (roleName) => {
    setError(null);
    setLoading(true);
    const suffix = Math.floor(1000 + Math.random() * 9000);
    try {
      const demoData = await registerAgency({
        agencyName: `Apex Agency ${suffix}`,
        agencySlug: `apex-${suffix}`,
        name: `Demo ${roleName}`,
        email: `demo.${roleName.toLowerCase()}.${suffix}@apex.com`,
        password: 'Password123!',
      });
      onLoginSuccess(demoData.user, demoData.agency);
    } catch (err) {
      setError(err.message || 'Quick demo setup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="panel-card"
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 36,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            className="brand-icon"
            style={{ width: 48, height: 48, margin: '0 auto 16px auto' }}
          >
            <svg
              width="26"
              height="26"
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
            {isRegistering ? 'Create Agency Workspace' : 'Sign in to Agency SaaS'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
            {isRegistering
              ? 'Phase 2: Authentication & Team RBAC'
              : 'Enter credentials to access your agency dashboard'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 'var(--radius-md)',
              color: '#fca5a5',
              fontSize: '0.85rem',
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isRegistering && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
                  AGENCY NAME
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Growth Agency"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
                  YOUR FULL NAME (OWNER)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Alice Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                  }}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
              EMAIL ADDRESS
            </label>
            <input
              type="email"
              required
              placeholder="owner@agency.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
              PASSWORD
            </label>
            <input
              type="password"
              required
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px 16px', marginTop: 8, fontSize: '0.95rem' }}
          >
            {loading ? 'Authenticating...' : isRegistering ? 'Create Agency Account' : 'Sign In'}
          </button>
        </form>

        {/* Toggle Mode */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isRegistering ? 'Already have an agency account? ' : "Don't have an agency account? "}
          </span>
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {isRegistering ? 'Sign In' : 'Create Agency'}
          </button>
        </div>

        {/* Quick Demo Launch */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Instant Testing Presets
          </span>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
            <button
              onClick={() => handleQuickDemoSetup('Owner')}
              className="btn btn-secondary btn-sm"
              disabled={loading}
            >
              Demo Owner
            </button>
            <button
              onClick={() => handleQuickDemoSetup('Admin')}
              className="btn btn-secondary btn-sm"
              disabled={loading}
            >
              Demo Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
