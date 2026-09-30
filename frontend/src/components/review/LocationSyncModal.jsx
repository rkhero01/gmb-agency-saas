import React, { useState } from 'react';
import { syncLocationReviews } from '../../services/api.js';

export function LocationSyncModal({
  isOpen,
  onClose,
  locations = [],
  clients = [],
  onSyncComplete,
  defaultLocationId = '',
}) {
  const [selectedLocationId, setSelectedLocationId] = useState(defaultLocationId);
  const [maxPages, setMaxPages] = useState('2');
  const [pageSize, setPageSize] = useState('20');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  if (!isOpen) return null;

  const handleSync = async (e) => {
    e.preventDefault();
    if (!selectedLocationId) {
      setSyncError('Please choose a location to synchronize.');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const options = {
        maxPages: Number(maxPages) || 2,
        pageSize: Number(pageSize) || 20,
      };

      const result = await syncLocationReviews(selectedLocationId, options);
      onSyncComplete?.(result);
      onClose();
    } catch (err) {
      setSyncError(err.message || 'Review synchronization failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSyncing) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: 520,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.2rem' }}>🔄</span>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                Synchronize Google Reviews
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Fetch customer reviews directly from Google Business Profile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSyncing}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-subtle)',
              fontSize: '1.2rem',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSync}>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {syncError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--danger-bg)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  fontSize: '0.8rem',
                }}
              >
                {syncError}
              </div>
            )}

            {/* Location Selector */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  marginBottom: 6,
                }}
              >
                Target Location *
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                disabled={isSyncing}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              >
                <option value="">-- Select a Location --</option>
                {locations.map((loc) => {
                  const client = clients.find((c) => c.id === loc.client_id);
                  return (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.city ? `(${loc.city}, ${loc.state})` : ''}{' '}
                      {client ? `— ${client.name}` : ''}
                    </option>
                  );
                })}
              </select>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: 4, display: 'block' }}>
                Ensure this location is linked to a Google Business Profile in the Google tab.
              </span>
            </div>

            {/* Sync Pagination Options */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    marginBottom: 6,
                  }}
                >
                  Page Size
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value)}
                  disabled={isSyncing}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="10">10 reviews/page</option>
                  <option value="20">20 reviews/page</option>
                  <option value="50">50 reviews/page</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    marginBottom: 6,
                  }}
                >
                  Max Pages to Fetch
                </label>
                <select
                  value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value)}
                  disabled={isSyncing}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="1">1 page (Fast check)</option>
                  <option value="2">2 pages (Recent)</option>
                  <option value="5">5 pages (Deep sync)</option>
                </select>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '0.75rem',
                color: '#a5b4fc',
                lineHeight: 1.5,
              }}
            >
              🔒 <strong>Tenant Safe</strong>: Reviews are automatically mapped to your agency workspace. Any existing review replies published directly on Google will be imported.
            </div>
          </div>

          {/* Modal Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 12,
              background: 'rgba(0, 0, 0, 0.15)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSyncing}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSyncing || !selectedLocationId}
              className="btn btn-primary"
              style={{
                fontSize: '0.85rem',
                opacity: isSyncing || !selectedLocationId ? 0.6 : 1,
              }}
            >
              {isSyncing ? 'Synchronizing Reviews...' : 'Start Sync Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
