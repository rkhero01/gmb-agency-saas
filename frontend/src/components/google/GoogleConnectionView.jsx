import React, { useState, useEffect, useCallback } from 'react';
import {
  getGoogleConnectUrl,
  getGoogleStatus,
  getGoogleAccounts,
  getGoogleLocations,
  getLinkedProfiles,
  linkGoogleLocation,
  unlinkGoogleLocation,
  disconnectGoogle,
  listClients,
  listLocations,
} from '../../services/api.js';

export function GoogleConnectionView({ currentUser, currentAgency }) {
  // Connection state
  const [connection, setConnection] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Google Accounts & Locations
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [googleLocations, setGoogleLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [linkedProfiles, setLinkedProfiles] = useState([]);

  // Internal Hierarchy for Linking
  const [clients, setClients] = useState([]);
  const [internalLocationsByClient, setInternalLocationsByClient] = useState({});
  const [loadingInternal, setLoadingInternal] = useState(false);

  // Linking Modal State
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [targetGoogleLoc, setTargetGoogleLoc] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedInternalLocId, setSelectedInternalLocId] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // Disconnect Confirmation State
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Connecting state
  const [isInitiatingOAuth, setIsInitiatingOAuth] = useState(false);

  // Role permissions
  const role = currentUser?.role?.toLowerCase() || 'viewer';
  const canManage = ['owner', 'admin', 'manager'].includes(role);

  // Parse URL query params for OAuth callback return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('status');
    const oauthError = params.get('error');

    if (oauthStatus === 'connected') {
      setActionSuccess('Google account connected successfully! Welcome to GBP integration.');
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (oauthError) {
      setActionError(`Google OAuth connection failed: ${decodeURIComponent(oauthError)}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch connection status and linked profiles
  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setStatusError(null);
    try {
      const statusRes = await getGoogleStatus();
      setConnection(statusRes || null);

      if (statusRes?.connected) {
        // Load linked profiles
        try {
          const profiles = await getLinkedProfiles();
          setLinkedProfiles(profiles || []);
        } catch (err) {
          console.warn('Could not load linked profiles:', err.message);
        }

        // Load Google accounts
        try {
          const accountsRes = await getGoogleAccounts();
          setAccounts(accountsRes || []);
          if (accountsRes && accountsRes.length > 0) {
            setSelectedAccountId(accountsRes[0].id);
          }
        } catch (err) {
          console.warn('Could not load Google accounts:', err.message);
        }
      }
    } catch (err) {
      setStatusError(err.message || 'Failed to retrieve Google connection status.');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // Fetch Google locations when selectedAccountId changes
  const loadGoogleLocations = useCallback(async (accountId) => {
    if (!accountId) return;
    setLoadingLocations(true);
    try {
      const locs = await getGoogleLocations(accountId);
      setGoogleLocations(locs || []);
    } catch (err) {
      console.warn('Could not fetch Google locations:', err.message);
      setGoogleLocations([]);
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  // Fetch internal clients and locations for linking modal
  const loadInternalHierarchy = useCallback(async () => {
    setLoadingInternal(true);
    try {
      const clientList = await listClients();
      setClients(clientList || []);

      // Pre-fetch locations for all clients
      const locMap = {};
      await Promise.all(
        (clientList || []).map(async (cl) => {
          try {
            const locs = await listLocations(cl.id);
            locMap[cl.id] = locs || [];
          } catch (e) {
            locMap[cl.id] = [];
          }
        })
      );
      setInternalLocationsByClient(locMap);
    } catch (err) {
      console.warn('Could not load internal clients:', err.message);
    } finally {
      setLoadingInternal(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadInternalHierarchy();
  }, [loadStatus, loadInternalHierarchy]);

  useEffect(() => {
    if (selectedAccountId) {
      loadGoogleLocations(selectedAccountId);
    }
  }, [selectedAccountId, loadGoogleLocations]);

  // Initiate OAuth flow
  const handleConnectGoogle = async () => {
    if (!canManage) return;
    setIsInitiatingOAuth(true);
    setActionError(null);
    try {
      const data = await getGoogleConnectUrl();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Server did not return a valid Google authorization URL.');
      }
    } catch (err) {
      setActionError(err.message || 'Failed to initiate Google OAuth.');
      setIsInitiatingOAuth(false);
    }
  };

  // Open Link Modal
  const handleOpenLinkModal = (googleLoc) => {
    setTargetGoogleLoc(googleLoc);
    setSelectedClientId(clients.length > 0 ? clients[0].id : '');
    setSelectedInternalLocId('');
    setLinkModalOpen(true);
  };

  // Submit Link
  const handleSubmitLink = async (e) => {
    e.preventDefault();
    if (!selectedInternalLocId || !targetGoogleLoc) return;

    setIsLinking(true);
    setActionError(null);
    try {
      await linkGoogleLocation(selectedInternalLocId, {
        googleLocationId: targetGoogleLoc.googleLocationId,
        googleAccountId: selectedAccountId,
        profileName: targetGoogleLoc.title || targetGoogleLoc.name,
      });

      setActionSuccess(`Location "${targetGoogleLoc.title}" successfully linked!`);
      setLinkModalOpen(false);
      setTargetGoogleLoc(null);
      setTimeout(() => setActionSuccess(null), 4000);

      // Refresh linked profiles
      const profiles = await getLinkedProfiles();
      setLinkedProfiles(profiles || []);
    } catch (err) {
      setActionError(err.message || 'Failed to link Google location.');
    } finally {
      setIsLinking(false);
    }
  };

  // Unlink Location
  const handleUnlink = async (locationId, profileName) => {
    if (!canManage) return;
    setActionError(null);
    try {
      await unlinkGoogleLocation(locationId);
      setActionSuccess(`Unlinked Google Business Profile for "${profileName}".`);
      setTimeout(() => setActionSuccess(null), 4000);
      const profiles = await getLinkedProfiles();
      setLinkedProfiles(profiles || []);
    } catch (err) {
      setActionError(err.message || 'Failed to unlink location.');
    }
  };

  // Disconnect Google Account
  const handleDisconnect = async () => {
    if (!canManage) return;
    setIsDisconnecting(true);
    setActionError(null);
    try {
      await disconnectGoogle();
      setActionSuccess('Google account disconnected successfully.');
      setDisconnectModalOpen(false);
      setTimeout(() => setActionSuccess(null), 4000);
      await loadStatus();
      setGoogleLocations([]);
      setAccounts([]);
    } catch (err) {
      setActionError(err.message || 'Failed to disconnect Google account.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isConnected = connection?.connected;
  const connectedAccount = connection?.account;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* View Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: '1.5rem' }}>🌐</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Google Business Profile Integration
            </h2>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: '#a5b4fc',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              Phase 4 Active
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            Authorize and map Google Business Profile locations to{' '}
            <strong style={{ color: '#ffffff' }}>{currentAgency?.name}</strong> client locations.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={loadStatus}
            disabled={loadingStatus}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
          >
            <span>🔄</span>
            <span>{loadingStatus ? 'Syncing...' : 'Sync Status'}</span>
          </button>

          {!isConnected && canManage && (
            <button
              onClick={handleConnectGoogle}
              disabled={isInitiatingOAuth || loadingStatus}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.85rem',
                backgroundColor: '#4285f4',
                borderColor: '#4285f4',
              }}
            >
              <span>🔗</span>
              <span>{isInitiatingOAuth ? 'Redirecting to Google...' : 'Connect Google Account'}</span>
            </button>
          )}

          {isConnected && canManage && (
            <button
              onClick={() => setDisconnectModalOpen(true)}
              className="btn btn-danger"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
            >
              <span>✕</span>
              <span>Disconnect</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div
          style={{
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span>✓</span>
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div
          style={{
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span>⚠</span>
          <span>{actionError}</span>
        </div>
      )}

      {statusError && (
        <div
          style={{
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: '0.85rem',
          }}
        >
          {statusError}
        </div>
      )}

      {/* Connection Status Card */}
      <div className="panel-card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                border: isConnected
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : '1px solid var(--border-subtle)',
              }}
            >
              {isConnected ? '✅' : '🔒'}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  {isConnected ? 'Google Cloud OAuth Connected' : 'Google Account Not Connected'}
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: isConnected ? 'var(--success-bg)' : 'rgba(255, 255, 255, 0.05)',
                    color: isConnected ? 'var(--success)' : 'var(--text-subtle)',
                    border: isConnected
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : '1px solid var(--border-subtle)',
                  }}
                >
                  {isConnected ? 'Active & Scoped' : 'Disconnected'}
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
                {isConnected
                  ? 'Authenticated via Google OAuth 2.0 with minimal required scope (business.manage).'
                  : 'Connect your agency Google account to list and manage locations across clients.'}
              </p>
            </div>
          </div>

          {!isConnected && canManage && (
            <button
              onClick={handleConnectGoogle}
              disabled={isInitiatingOAuth || loadingStatus}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.85rem',
                backgroundColor: '#4285f4',
                borderColor: '#4285f4',
              }}
            >
              <span>🔗</span>
              <span>Connect with Google</span>
            </button>
          )}
        </div>

        {/* Connected Account Metadata Grid (Zero tokens displayed) */}
        {isConnected && connectedAccount && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--border-subtle)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              fontSize: '0.85rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', display: 'block' }}>
                Connected Google Account
              </span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>
                {connectedAccount.google_email || 'Verified Account'}
              </span>
            </div>

            <div>
              <span style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', display: 'block' }}>
                Account Holder Name
              </span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>
                {connectedAccount.google_name || 'Agency Manager'}
              </span>
            </div>

            <div>
              <span style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', display: 'block' }}>
                Tenant Isolation Boundary
              </span>
              <span style={{ color: '#a5b4fc', fontFamily: 'JetBrains Mono', fontSize: '0.78rem' }}>
                {currentAgency?.id?.slice(0, 13)}... (Protected)
              </span>
            </div>

            <div>
              <span style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', display: 'block' }}>
                Credential Storage Security
              </span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                Encrypted / RLS Isolated
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Linked Google Business Profiles Table */}
      <div className="panel-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
              Linked Google Business Profiles
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
              Locations successfully linked between Google Business Profile and internal database.
            </p>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-subtle)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            {linkedProfiles.length} Linked Location{linkedProfiles.length === 1 ? '' : 's'}
          </span>
        </div>

        {linkedProfiles.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 16px',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              backgroundColor: 'rgba(255, 255, 255, 0.01)',
              borderRadius: 8,
              border: '1px dashed var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>📍</div>
            <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: 4 }}>
              No Linked Google Locations
            </div>
            <div>
              {isConnected
                ? 'Select an available Google location below to link it to an existing client location.'
                : 'Connect your Google account above to begin mapping business profiles.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', color: 'var(--text-subtle)' }}>Profile Name</th>
                  <th style={{ padding: '10px 14px', color: 'var(--text-subtle)' }}>Google Location ID</th>
                  <th style={{ padding: '10px 14px', color: 'var(--text-subtle)' }}>Internal Location ID</th>
                  <th style={{ padding: '10px 14px', color: 'var(--text-subtle)' }}>Connection Status</th>
                  <th style={{ padding: '10px 14px', color: 'var(--text-subtle)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {linkedProfiles.map((prof) => (
                  <tr
                    key={prof.id}
                    style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}
                  >
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#ffffff' }}>
                      {prof.profile_name || 'Google Business Profile'}
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono', fontSize: '0.78rem', color: '#a5b4fc' }}>
                      {prof.google_location_id}
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {prof.location_id?.slice(0, 8)}...
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: 'var(--success-bg)',
                          color: 'var(--success)',
                        }}
                      >
                        {prof.connection_status || 'connected'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {canManage && (
                        <button
                          onClick={() => handleUnlink(prof.location_id, prof.profile_name)}
                          className="btn btn-secondary"
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 8px',
                            color: 'var(--danger)',
                          }}
                        >
                          Unlink
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Available Google Business Profile Locations (From Google API) */}
      {isConnected && (
        <div className="panel-card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                Accessible Google Business Profile Locations
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                Locations fetched from your connected Google Account via the Business Information API.
              </p>
            </div>

            {accounts.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>Account:</span>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: '0.8rem',
                  }}
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id} style={{ backgroundColor: '#1e293b' }}>
                      {acc.accountName || acc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {loadingLocations ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
              Loading Google locations...
            </div>
          ) : googleLocations.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '32px 16px',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                borderRadius: 8,
                border: '1px dashed var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '1.6rem', marginBottom: 8 }}>🏢</div>
              <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: 4 }}>
                No Google Business Profile Locations Found
              </div>
              <div>
                Your connected account does not have verified Google Business Profile locations yet,
                or has not been granted management access to any listing.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', color: 'var(--text-subtle)' }}>Listing Title</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-subtle)' }}>Storefront Address</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-subtle)' }}>Phone</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-subtle)' }}>Google ID</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-subtle)' }}>Status</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-subtle)' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {googleLocations.map((loc) => {
                    const isAlreadyLinked = linkedProfiles.some(
                      (p) => p.google_location_id === loc.googleLocationId
                    );

                    return (
                      <tr
                        key={loc.googleLocationId}
                        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}
                      >
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#ffffff' }}>
                          {loc.title || 'Untitled Location'}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                          {loc.storefrontAddress?.addressLines?.join(', ') ||
                            loc.storefrontAddress?.locality ||
                            'Address on file'}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                          {loc.phone || '—'}
                        </td>
                        <td
                          style={{
                            padding: '12px 14px',
                            fontFamily: 'JetBrains Mono',
                            fontSize: '0.78rem',
                            color: '#a5b4fc',
                          }}
                        >
                          {loc.googleLocationId}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {isAlreadyLinked ? (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: 'var(--success-bg)',
                                color: 'var(--success)',
                              }}
                            >
                              ✓ Linked
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: '0.75rem',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-subtle)',
                              }}
                            >
                              Unlinked
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {canManage && (
                            <button
                              onClick={() => handleOpenLinkModal(loc)}
                              disabled={isAlreadyLinked}
                              className="btn btn-secondary"
                              style={{
                                fontSize: '0.75rem',
                                padding: '4px 10px',
                                opacity: isAlreadyLinked ? 0.5 : 1,
                              }}
                            >
                              {isAlreadyLinked ? 'Already Linked' : 'Link to Internal Location'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Link Location Modal */}
      {linkModalOpen && targetGoogleLoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="panel-card"
            style={{
              width: '100%',
              maxWidth: 520,
              backgroundColor: '#0f172a',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                Link Google Profile to Location
              </h3>
              <button
                onClick={() => setLinkModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-subtle)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 20,
                fontSize: '0.85rem',
              }}
            >
              <div style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>Target Google Location:</div>
              <div style={{ fontWeight: 600, color: '#ffffff', marginTop: 2 }}>{targetGoogleLoc.title}</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: '#a5b4fc', marginTop: 2 }}>
                ID: {targetGoogleLoc.googleLocationId}
              </div>
            </div>

            <form onSubmit={handleSubmitLink} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-subtle)', marginBottom: 6 }}>
                  1. Select Client Brand
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    setSelectedInternalLocId('');
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="" disabled>Select a client...</option>
                  {clients.map((cl) => (
                    <option key={cl.id} value={cl.id} style={{ backgroundColor: '#1e293b' }}>
                      {cl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-subtle)', marginBottom: 6 }}>
                  2. Select Internal Location
                </label>
                <select
                  value={selectedInternalLocId}
                  onChange={(e) => setSelectedInternalLocId(e.target.value)}
                  required
                  disabled={!selectedClientId}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="" disabled>
                    {!selectedClientId
                      ? 'First select a client'
                      : (internalLocationsByClient[selectedClientId] || []).length === 0
                      ? 'No locations under this client'
                      : 'Select a location to link...'}
                  </option>
                  {(internalLocationsByClient[selectedClientId] || []).map((loc) => (
                    <option key={loc.id} value={loc.id} style={{ backgroundColor: '#1e293b' }}>
                      {loc.name} ({loc.city || 'No city'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setLinkModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedInternalLocId || isLinking}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem' }}
                >
                  {isLinking ? 'Linking...' : 'Confirm Association'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {disconnectModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="panel-card"
            style={{
              width: '100%',
              maxWidth: 440,
              backgroundColor: '#0f172a',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: 12 }}>
              Disconnect Google Account?
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 20 }}>
              This will safely clear stored OAuth credentials for{' '}
              <strong style={{ color: '#ffffff' }}>{connectedAccount?.google_email || 'this account'}</strong>.
              Existing location linkages will be preserved, but sync operations will pause until reconnected.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDisconnectModalOpen(false)}
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="btn btn-danger"
                style={{ fontSize: '0.85rem' }}
              >
                {isDisconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GoogleConnectionView;
