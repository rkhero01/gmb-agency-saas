import React, { useState, useEffect, useCallback } from 'react';
import {
  getTeamMembers,
  inviteTeamMember,
  updateMemberRole,
  updateMemberStatus,
} from '../../services/api.js';
import { StatusBadge } from '../ui/StatusBadge.jsx';

const ROLE_DESCRIPTIONS = {
  owner: 'Full agency ownership & governance',
  admin: 'Client & location management, team invites',
  manager: 'Manage assigned accounts & operations',
  specialist: 'GBP post and review workflows',
  viewer: 'Read-only metrics access',
};

export function TeamManagementView({ currentUser, currentAgency }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Invite Form State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('manager');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState(null);

  const isOwner = currentUser?.role === 'owner';
  const isAdmin = currentUser?.role === 'admin';
  const canManage = isOwner || isAdmin;

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTeamMembers();
      setMembers(data);
    } catch (err) {
      setError(err.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError(null);
    try {
      await inviteTeamMember({
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
      });
      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('manager');
      setActionSuccess(`Team member ${inviteName} invited successfully!`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchMembers();
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (userId, targetUserRole, newRole) => {
    setError(null);
    try {
      await updateMemberRole(userId, newRole);
      setActionSuccess('Role updated successfully.');
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    setError(null);
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await updateMemberStatus(userId, newStatus);
      setActionSuccess(`Member status updated to ${newStatus}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  const activeOwnersCount = members.filter(
    (m) => m.role === 'owner' && m.status === 'active'
  ).length;

  return (
    <div>
      {/* Header Section */}
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
            Agency Team Governance
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Manage staff members, role-based permissions, and workspace access for{' '}
            <strong style={{ color: '#ffffff' }}>{currentAgency?.name}</strong>.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span>+</span>
            <span>Invite Team Member</span>
          </button>
        )}
      </div>

      {/* Action Notification */}
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
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* RBAC Overview Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 28,
        }}
      >
        <div className="panel-card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            YOUR PERMISSION LEVEL
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>
            {currentUser?.role?.toUpperCase()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: 2 }}>
            {ROLE_DESCRIPTIONS[currentUser?.role] || 'Standard Access'}
          </div>
        </div>

        <div className="panel-card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            TOTAL TEAM MEMBERS
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
            {members.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: 2 }}>
            Across 5 functional roles
          </div>
        </div>

        <div className="panel-card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            ACTIVE OWNERS
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', marginTop: 4 }}>
            {activeOwnersCount} Owner{activeOwnersCount !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: 2 }}>
            {activeOwnersCount <= 1 ? '🛡️ Final Owner Protected' : '✓ Redundant Ownership'}
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Team Directory</h3>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading team roster...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '14px 20px', color: 'var(--text-subtle)', fontWeight: 600 }}>MEMBER</th>
                  <th style={{ padding: '14px 20px', color: 'var(--text-subtle)', fontWeight: 600 }}>ROLE</th>
                  <th style={{ padding: '14px 20px', color: 'var(--text-subtle)', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '14px 20px', color: 'var(--text-subtle)', fontWeight: 600 }}>JOINED</th>
                  {canManage && (
                    <th style={{ padding: '14px 20px', color: 'var(--text-subtle)', fontWeight: 600, textAlign: 'right' }}>
                      ACTIONS
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isTargetOwner = member.role === 'owner';
                  const isSelf = member.id === currentUser?.id;
                  const canEditThisUser =
                    isOwner || (isAdmin && !isTargetOwner && member.role !== 'admin');
                  const cannotDemoteFinalOwner = isTargetOwner && activeOwnersCount <= 1;

                  return (
                    <tr
                      key={member.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        backgroundColor: isSelf ? 'rgba(99, 102, 241, 0.04)' : undefined,
                      }}
                    >
                      {/* Member Info */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              color: '#ffffff',
                            }}
                          >
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#ffffff' }}>
                              {member.name} {isSelf && <span style={{ fontSize: '0.7rem', color: '#818cf8' }}>(You)</span>}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td style={{ padding: '14px 20px' }}>
                        {canEditThisUser ? (
                          <select
                            value={member.role}
                            disabled={cannotDemoteFinalOwner}
                            onChange={(e) =>
                              handleRoleChange(member.id, member.role, e.target.value)
                            }
                            style={{
                              padding: '5px 8px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border-subtle)',
                              color: '#ffffff',
                              fontSize: '0.8rem',
                              cursor: cannotDemoteFinalOwner ? 'not-allowed' : 'pointer',
                            }}
                            title={
                              cannotDemoteFinalOwner
                                ? 'Cannot demote the final active owner'
                                : 'Change role'
                            }
                          >
                            {isOwner && <option value="owner">Owner</option>}
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="specialist">Specialist</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span
                            style={{
                              textTransform: 'capitalize',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-full)',
                              background:
                                member.role === 'owner'
                                  ? 'rgba(99, 102, 241, 0.15)'
                                  : 'rgba(255, 255, 255, 0.05)',
                              color: member.role === 'owner' ? '#a5b4fc' : '#ffffff',
                            }}
                          >
                            {member.role}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 20px' }}>
                        <StatusBadge
                          status={member.status === 'active' ? 'active' : 'error'}
                          text={member.status}
                        />
                      </td>

                      {/* Joined Date */}
                      <td style={{ padding: '14px 20px', color: 'var(--text-subtle)', fontSize: '0.8rem' }}>
                        {new Date(member.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      {canManage && (
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          {canEditThisUser && !isSelf && (
                            <button
                              onClick={() => handleStatusToggle(member.id, member.status)}
                              disabled={cannotDemoteFinalOwner && member.status === 'active'}
                              className={`btn btn-sm ${
                                member.status === 'active' ? 'btn-secondary' : 'btn-primary'
                              }`}
                              style={{ fontSize: '0.75rem' }}
                              title={
                                cannotDemoteFinalOwner
                                  ? 'Cannot deactivate final owner'
                                  : undefined
                              }
                            >
                              {member.status === 'active' ? 'Deactivate' : 'Reactivate'}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: 20,
          }}
        >
          <div
            className="panel-card"
            style={{
              width: '100%',
              maxWidth: 440,
              padding: 28,
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 4 }}>
              Invite New Team Member
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 20 }}>
              Add a staff user to {currentAgency?.name}. An initial secure password will be generated.
            </p>

            {inviteError && (
              <div
                style={{
                  padding: 10,
                  backgroundColor: 'var(--danger-bg)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  color: '#fca5a5',
                  fontSize: '0.8rem',
                  marginBottom: 16,
                }}
              >
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  FULL NAME
                </label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  WORK EMAIL
                </label>
                <input
                  type="email"
                  required
                  placeholder="john@agency.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  ASSIGN ROLE
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
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
                  {isOwner && <option value="owner">Owner (Full Governance)</option>}
                  <option value="admin">Admin (Manage Clients & Team)</option>
                  <option value="manager">Manager (Account Operations)</option>
                  <option value="specialist">Specialist (GBP Updates & Posts)</option>
                  <option value="viewer">Viewer (Read-Only)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn btn-secondary"
                  disabled={inviteLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={inviteLoading}
                >
                  {inviteLoading ? 'Sending Invite...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
