import React, { useState, useEffect, useCallback } from 'react';
import {
  listClients,
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from '../../services/api.js';
import { LocationFormModal } from './LocationFormModal.jsx';

export function LocationManagementView({
  currentUser,
  currentAgency,
  initialClient = null,
  onBackToClients,
}) {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(initialClient);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Delete Confirmation State
  const [deletingLocation, setDeletingLocation] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Role Permissions
  const role = currentUser?.role?.toLowerCase() || 'viewer';
  const canCreate = ['owner', 'admin', 'manager'].includes(role);
  const canEdit = ['owner', 'admin', 'manager', 'specialist'].includes(role);
  const canDelete = ['owner', 'admin'].includes(role);

  // Fetch client list for client selector
  useEffect(() => {
    async function loadClients() {
      try {
        const clientList = await listClients();
        setClients(clientList || []);
        if (!selectedClient && clientList && clientList.length > 0) {
          setSelectedClient(clientList[0]);
        }
      } catch (err) {
        console.error('Failed to load clients in location view:', err);
      }
    }
    loadClients();
  }, []);

  // Update selected client if initialClient prop changes
  useEffect(() => {
    if (initialClient) {
      setSelectedClient(initialClient);
    }
  }, [initialClient]);

  // Fetch locations for selected client
  const fetchLocations = useCallback(async () => {
    if (!selectedClient?.id) {
      setLocations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await listLocations(selectedClient.id);
      setLocations(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load locations for this client.');
    } finally {
      setLoading(false);
    }
  }, [selectedClient?.id]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleOpenCreateModal = () => {
    setEditingLocation(null);
    setModalError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (loc) => {
    setEditingLocation(loc);
    setModalError(null);
    setModalOpen(true);
  };

  const handleModalSubmit = async (payload) => {
    setModalLoading(true);
    setModalError(null);
    try {
      if (editingLocation) {
        await updateLocation(editingLocation.id, payload);
        setActionSuccess(`Location "${payload.name}" updated successfully.`);
      } else {
        await createLocation(selectedClient.id, payload);
        setActionSuccess(`Location "${payload.name}" created successfully.`);
      }
      setModalOpen(false);
      setEditingLocation(null);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchLocations();
    } catch (err) {
      setModalError(err.message || 'Failed to save location.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!deletingLocation) return;
    setDeleteLoading(true);
    try {
      await deleteLocation(deletingLocation.id);
      setActionSuccess(`Location "${deletingLocation.name}" deleted successfully.`);
      setDeletingLocation(null);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchLocations();
    } catch (err) {
      setError(err.message || 'Failed to delete location.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: 'var(--success-bg)',
              color: 'var(--success)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
            }}
          >
            Active
          </span>
        );
      case 'pending':
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: 'var(--warning-bg)',
              color: 'var(--warning)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
            }}
          >
            Pending
          </span>
        );
      case 'suspended':
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            Suspended
          </span>
        );
      case 'archived':
      default:
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-subtle)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            Archived
          </span>
        );
    }
  };

  return (
    <div>
      {/* Top Navigation & Breadcrumb */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onBackToClients && (
            <button
              onClick={onBackToClients}
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
              }}
            >
              <span>←</span>
              <span>All Clients</span>
            </button>
          )}

          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
              Physical Branch Locations
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Physical stores, service areas, and Google Business Profile endpoints for{' '}
              <strong style={{ color: '#ffffff' }}>{selectedClient?.name || 'Selected Client'}</strong>.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Client Selector Dropdown */}
          {clients.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Client:</span>
              <select
                value={selectedClient?.id || ''}
                onChange={(e) => {
                  const found = clients.find((c) => c.id === e.target.value);
                  if (found) setSelectedClient(found);
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={fetchLocations}
            disabled={loading}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
            title="Refresh locations"
          >
            <span>🔄</span>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {canCreate && selectedClient && (
            <button
              onClick={handleOpenCreateModal}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}
            >
              <span>+</span>
              <span>Add Location</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--success-bg)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#6ee7b7',
            fontSize: '0.85rem',
            marginBottom: 20,
          }}
        >
          ✓ {actionSuccess}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-md)',
            color: '#fca5a5',
            fontSize: '0.85rem',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚠ {error}</span>
          <button
            onClick={fetchLocations}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Client Context Banner */}
      {selectedClient && (
        <div
          className="panel-card"
          style={{
            padding: 16,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            borderLeft: '4px solid var(--primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-md)',
                background: 'var(--primary-subtle)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.1rem',
              }}
            >
              🏢
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                {selectedClient.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {selectedClient.business_name || 'Individual Brand'} • {selectedClient.email || 'No email registered'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>LOCATIONS COUNT</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>{locations.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* Locations Table Card */}
      <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
            Branch Location Directory
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {locations.length} {locations.length === 1 ? 'location' : 'locations'} configured
          </span>
        </div>

        {loading && locations.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Loading locations...
          </div>
        ) : locations.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>📍</div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
              No locations added for {selectedClient?.name || 'this client'}
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 440, margin: '0 auto 20px' }}>
              Add a branch address or service area location. Each location maps to a distinct Google Business Profile in Phase 4.
            </p>
            {canCreate && selectedClient && (
              <button onClick={handleOpenCreateModal} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                + Add First Location
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 20px', color: 'var(--text-subtle)' }}>LOCATION NAME</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-subtle)' }}>PHYSICAL ADDRESS</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-subtle)' }}>TIMEZONE</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-subtle)' }}>PHONE</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-subtle)' }}>STATUS</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-subtle)', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => {
                  const fullAddress = [
                    loc.address_line1,
                    loc.address_line2,
                    loc.city,
                    loc.state,
                    loc.postal_code,
                    loc.country,
                  ]
                    .filter(Boolean)
                    .join(', ');

                  return (
                    <tr
                      key={loc.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Name */}
                      <td style={{ padding: '14px 20px', fontWeight: 600, color: '#ffffff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '1.1rem' }}>📍</span>
                          <div>
                            <div>{loc.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontFamily: 'JetBrains Mono' }}>
                              ID: {loc.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Physical Address */}
                      <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>
                        {fullAddress || '—'}
                      </td>

                      {/* Timezone */}
                      <td style={{ padding: '14px 20px', color: 'var(--text-subtle)', fontSize: '0.8rem' }}>
                        {loc.timezone || '—'}
                      </td>

                      {/* Phone */}
                      <td style={{ padding: '14px 20px', color: '#ffffff' }}>
                        {loc.phone || '—'}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 20px' }}>
                        {getStatusBadge(loc.status)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEditModal(loc)}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '5px 8px' }}
                              title="Edit Location"
                            >
                              Edit
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => setDeletingLocation(loc)}
                              className="btn btn-sm btn-secondary"
                              style={{
                                fontSize: '0.75rem',
                                padding: '5px 8px',
                                color: '#fca5a5',
                                borderColor: 'rgba(239, 68, 68, 0.3)',
                              }}
                              title="Delete Location"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Location Form Modal (Create / Edit) */}
      <LocationFormModal
        isOpen={modalOpen}
        onClose={() => {
          if (!modalLoading) {
            setModalOpen(false);
            setEditingLocation(null);
          }
        }}
        onSubmit={handleModalSubmit}
        location={editingLocation}
        clientName={selectedClient?.name || ''}
        loading={modalLoading}
        error={modalError}
      />

      {/* Delete Confirmation Modal */}
      {deletingLocation && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="panel-card"
            style={{
              width: '100%',
              maxWidth: 420,
              padding: 24,
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f87171', marginBottom: 8 }}>
              Confirm Location Deletion
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
              Are you sure you want to delete <strong style={{ color: '#ffffff' }}>"{deletingLocation.name}"</strong>?
              This branch and any associated GBP profile records will be permanently removed.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeletingLocation(null)}
                disabled={deleteLoading}
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteLocation}
                disabled={deleteLoading}
                className="btn"
                style={{
                  fontSize: '0.85rem',
                  backgroundColor: 'var(--danger)',
                  color: '#ffffff',
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Yes, Delete Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
