import React, { useState, useEffect, useCallback } from 'react';
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
} from '../../services/api.js';
import { ClientFormModal } from './ClientFormModal.jsx';

export function ClientManagementView({
  currentUser,
  currentAgency,
  onSelectClient,
}) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Delete Confirmation State
  const [deletingClient, setDeletingClient] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Role Permissions
  const role = currentUser?.role?.toLowerCase() || 'viewer';
  const canCreate = ['owner', 'admin'].includes(role);
  const canEdit = ['owner', 'admin', 'manager'].includes(role);
  const canDelete = ['owner', 'admin'].includes(role);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listClients();
      setClients(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load client list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleOpenCreateModal = () => {
    setEditingClient(null);
    setModalError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (client) => {
    setEditingClient(client);
    setModalError(null);
    setModalOpen(true);
  };

  const handleModalSubmit = async (payload) => {
    setModalLoading(true);
    setModalError(null);
    try {
      if (editingClient) {
        await updateClient(editingClient.id, payload);
        setActionSuccess(`Client "${payload.name}" updated successfully.`);
      } else {
        await createClient(payload);
        setActionSuccess(`Client "${payload.name}" created successfully.`);
      }
      setModalOpen(false);
      setEditingClient(null);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchClients();
    } catch (err) {
      setModalError(err.message || 'Failed to save client.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!deletingClient) return;
    setDeleteLoading(true);
    try {
      await deleteClient(deletingClient.id);
      setActionSuccess(`Client "${deletingClient.name}" and associated locations deleted.`);
      setDeletingClient(null);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchClients();
    } catch (err) {
      setError(err.message || 'Failed to delete client.');
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
      case 'inactive':
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
            Inactive
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
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
            Client Brand Portfolio
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Managing multi-location client brands and corporate entities for{' '}
            <strong style={{ color: '#ffffff' }}>{currentAgency?.name}</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={fetchClients}
            disabled={loading}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
            title="Refresh client list"
          >
            <span>🔄</span>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {canCreate && (
            <button
              onClick={handleOpenCreateModal}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}
            >
              <span>+</span>
              <span>Add Client Brand</span>
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
            onClick={fetchClients}
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

      {/* Summary Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
      >
        <div className="panel-card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            TOTAL CLIENTS
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
            {clients.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: 2 }}>
            Across agency portfolio
          </div>
        </div>

        <div className="panel-card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            ACTIVE BRANDS
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>
            {clients.filter((c) => c.status === 'active').length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: 2 }}>
            Eligible for GBP operations
          </div>
        </div>

        <div className="panel-card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            ROLE ACCESS LEVEL
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>
            {role.toUpperCase()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: 2 }}>
            {canCreate ? 'Full Client Management' : canEdit ? 'Client Update Access' : 'Read-Only Access'}
          </div>
        </div>
      </div>

      {/* Clients Table Card */}
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
            Client Brand Directory
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {clients.length} {clients.length === 1 ? 'client' : 'clients'} registered
          </span>
        </div>

        {loading && clients.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Loading clients...
          </div>
        ) : clients.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🏢</div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
              No clients yet
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 400, margin: '0 auto 20px' }}>
              Add your agency's first client brand to organize branch locations and manage Google Business Profiles.
            </p>
            {canCreate && (
              <button onClick={handleOpenCreateModal} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                + Add First Client
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 20px', color: 'var(--text-subtle)' }}>CLIENT / BRAND</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-subtle)' }}>LEGAL ENTITY</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-subtle)' }}>CONTACT</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-subtle)' }}>WEBSITE</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-subtle)' }}>STATUS</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-subtle)' }}>CREATED</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-subtle)', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr
                    key={client.id}
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
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--primary-subtle)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                          }}
                        >
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div>{client.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontFamily: 'JetBrains Mono' }}>
                            ID: {client.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Legal Entity */}
                    <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>
                      {client.business_name || '—'}
                    </td>

                    {/* Contact Email/Phone */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ color: '#ffffff' }}>{client.email || '—'}</div>
                      {client.phone && (
                        <div style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>{client.phone}</div>
                      )}
                    </td>

                    {/* Website */}
                    <td style={{ padding: '14px 20px' }}>
                      {client.website ? (
                        <a
                          href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#818cf8', textDecoration: 'none' }}
                        >
                          {client.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-subtle)' }}>—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 20px' }}>
                      {getStatusBadge(client.status)}
                    </td>

                    {/* Created Date */}
                    <td style={{ padding: '14px 20px', color: 'var(--text-subtle)', fontSize: '0.8rem' }}>
                      {new Date(client.created_at).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, alignItems: 'center' }}>
                        {/* Locations Button */}
                        <button
                          onClick={() => onSelectClient && onSelectClient(client)}
                          className="btn btn-sm btn-secondary"
                          style={{
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '5px 10px',
                            color: '#a5b4fc',
                            borderColor: 'rgba(99, 102, 241, 0.3)',
                          }}
                          title={`Manage locations for ${client.name}`}
                        >
                          <span>📍</span>
                          <span>Locations</span>
                        </button>

                        {/* Edit Button */}
                        {canEdit && (
                          <button
                            onClick={() => handleOpenEditModal(client)}
                            className="btn btn-sm btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '5px 8px' }}
                            title="Edit Client"
                          >
                            Edit
                          </button>
                        )}

                        {/* Delete Button */}
                        {canDelete && (
                          <button
                            onClick={() => setDeletingClient(client)}
                            className="btn btn-sm btn-secondary"
                            style={{
                              fontSize: '0.75rem',
                              padding: '5px 8px',
                              color: '#fca5a5',
                              borderColor: 'rgba(239, 68, 68, 0.3)',
                            }}
                            title="Delete Client"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Client Form Modal (Create / Edit) */}
      <ClientFormModal
        isOpen={modalOpen}
        onClose={() => {
          if (!modalLoading) {
            setModalOpen(false);
            setEditingClient(null);
          }
        }}
        onSubmit={handleModalSubmit}
        client={editingClient}
        loading={modalLoading}
        error={modalError}
      />

      {/* Delete Confirmation Modal */}
      {deletingClient && (
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
              Confirm Client Deletion
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
              Are you sure you want to delete <strong style={{ color: '#ffffff' }}>"{deletingClient.name}"</strong>?
              This will permanently delete this client brand along with all associated physical locations and GBP links.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeletingClient(null)}
                disabled={deleteLoading}
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteClient}
                disabled={deleteLoading}
                className="btn"
                style={{
                  fontSize: '0.85rem',
                  backgroundColor: 'var(--danger)',
                  color: '#ffffff',
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Yes, Delete Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
