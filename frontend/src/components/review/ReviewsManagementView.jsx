import React, { useState, useEffect, useCallback } from 'react';
import {
  listReviews,
  getReviewStats,
  listClients,
  listLocations,
  saveReplyDraft,
} from '../../services/api.js';
import { ReviewStatsHeader } from './ReviewStatsHeader.jsx';
import { ReviewFiltersBar } from './ReviewFiltersBar.jsx';
import { ReviewCard } from './ReviewCard.jsx';
import { LocationSyncModal } from './LocationSyncModal.jsx';
import { AiReplyModal } from './AiReplyModal.jsx';

export function ReviewsManagementView({ currentUser, currentAgency }) {
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 15,
    offset: 0,
    page: 1,
    totalPages: 1,
  });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Hierarchy Data for Filters
  const [clients, setClients] = useState([]);
  const [locations, setLocations] = useState([]);

  // Filter State
  const [filters, setFilters] = useState({
    clientId: '',
    locationId: '',
    starRating: '',
    replyStatus: '',
    status: '',
    search: '',
    sortBy: 'review_create_time',
    sortOrder: 'desc',
    limit: 15,
    page: 1,
  });

  // Modals
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [targetReviewForAi, setTargetReviewForAi] = useState(null);

  // Role permissions
  const role = currentUser?.role?.toLowerCase() || 'viewer';
  const canSync = ['owner', 'admin', 'manager', 'specialist'].includes(role);

  // Load clients and locations for filter dropdowns
  useEffect(() => {
    async function loadHierarchy() {
      try {
        const clientList = await listClients();
        setClients(clientList || []);

        // Load locations for all clients
        const allLocs = [];
        for (const client of clientList || []) {
          try {
            const locs = await listLocations(client.id);
            if (Array.isArray(locs)) {
              allLocs.push(...locs);
            }
          } catch (e) {
            // Ignore individual location load failures
          }
        }
        setLocations(allLocs);
      } catch (err) {
        console.error('Failed to load clients/locations for review filters:', err);
      }
    }
    loadHierarchy();
  }, []);

  // Fetch reviews based on active filters
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listReviews(filters);
      setReviews(result.reviews || []);
      setPagination(
        result.pagination || {
          total: result.total || 0,
          limit: filters.limit,
          offset: 0,
          page: filters.page,
          totalPages: Math.ceil((result.total || 0) / filters.limit) || 1,
        }
      );
    } catch (err) {
      setError(err.message || 'Failed to load reviews.');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch summary review statistics
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const statsData = await getReviewStats({
        clientId: filters.clientId,
        locationId: filters.locationId,
        starRating: filters.starRating,
        replyStatus: filters.replyStatus,
        status: filters.status,
      });
      setStats(statsData);
    } catch (err) {
      console.warn('Failed to load review stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [filters.clientId, filters.locationId, filters.starRating, filters.replyStatus, filters.status]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Handlers
  const handleFilterChange = (newFilters) => {
    setFilters({ ...newFilters, page: 1 });
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setFilters((prev) => ({
      ...prev,
      page: newPage,
      offset: (newPage - 1) * prev.limit,
    }));
  };

  const handleOpenAiModal = (review) => {
    setTargetReviewForAi(review);
    setAiModalOpen(true);
  };

  const handleApplyAiSuggestion = async (suggestedText) => {
    if (!targetReviewForAi) return;
    try {
      await saveReplyDraft(targetReviewForAi.id, suggestedText);
      setActionSuccess('AI reply suggestion applied and saved to draft!');
      setTimeout(() => setActionSuccess(null), 4000);
      fetchReviews();
    } catch (err) {
      setError(err.message || 'Failed to save suggested reply to draft.');
    }
  };

  const handleSyncComplete = (syncResult) => {
    setActionSuccess(
      `Synchronized ${syncResult?.synced || 0} reviews across ${
        syncResult?.pages || 1
      } page(s) successfully!`
    );
    setTimeout(() => setActionSuccess(null), 5000);
    fetchReviews();
    fetchStats();
  };

  return (
    <div>
      {/* View Header */}
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
              Reviews & AI Reply Workflow
            </h2>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#6ee7b7',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                textTransform: 'uppercase',
              }}
            >
              Phase 5 Active
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Monitor customer reviews, generate AI responses, manage approval gates, and publish to Google Business Profiles.
          </p>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {canSync && (
            <button
              onClick={() => setSyncModalOpen(true)}
              className="btn btn-primary"
              style={{
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>🔄</span>
              <span>Sync Location Reviews</span>
            </button>
          )}
        </div>
      </div>

      {/* Action Notification Toasts */}
      {actionSuccess && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--success-bg)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#6ee7b7',
            fontSize: '0.85rem',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>✓ {actionSuccess}</span>
          <button
            onClick={() => setActionSuccess(null)}
            style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '0.85rem',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>✕ {error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Review Analytics Stats Header */}
      <ReviewStatsHeader stats={stats} loading={loadingStats} />

      {/* Filters Bar */}
      <ReviewFiltersBar
        filters={filters}
        onFilterChange={handleFilterChange}
        clients={clients}
        locations={locations}
        onOpenSyncModal={() => setSyncModalOpen(true)}
        canSync={canSync}
        totalReviews={pagination.total}
      />

      {/* Review Cards List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                minHeight: 140,
                opacity: 0.6,
                animation: 'pulse 1.5s infinite',
              }}
            >
              <div
                style={{
                  height: 20,
                  width: '30%',
                  background: 'var(--border-subtle)',
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              />
              <div
                style={{
                  height: 14,
                  width: '80%',
                  background: 'var(--border-subtle)',
                  borderRadius: 4,
                  marginBottom: 8,
                }}
              />
              <div
                style={{
                  height: 14,
                  width: '60%',
                  background: 'var(--border-subtle)',
                  borderRadius: 4,
                }}
              />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        /* Empty State */
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '48px 32px',
            textAlign: 'center',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⭐</div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>
            No Customer Reviews Found
          </h3>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              maxWidth: 480,
              margin: '0 auto 20px auto',
              lineHeight: 1.5,
            }}
          >
            {filters.search || filters.starRating || filters.replyStatus || filters.clientId || filters.locationId
              ? 'No reviews match your current filter parameters. Try clearing or broadening your search.'
              : 'Your locations have not synchronized any Google Business Profile reviews yet.'}
          </p>
          {canSync && (
            <button
              onClick={() => setSyncModalOpen(true)}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem' }}
            >
              🔄 Synchronize Google Reviews
            </button>
          )}
        </div>
      ) : (
        /* Render Reviews */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reviews.map((rev) => (
            <ReviewCard
              key={rev.id}
              review={rev}
              currentUser={currentUser}
              onReviewUpdated={fetchReviews}
              onOpenAiModal={handleOpenAiModal}
            />
          ))}

          {/* Pagination Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              marginTop: 10,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing {reviews.length} of {pagination.total} review(s)
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem' }}
              >
                ← Previous
              </button>
              <span style={{ fontSize: '0.8rem', color: '#ffffff', padding: '0 8px' }}>
                Page {pagination.page} of {pagination.totalPages || 1}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem' }}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Sync Modal */}
      <LocationSyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        locations={locations}
        clients={clients}
        onSyncComplete={handleSyncComplete}
        defaultLocationId={filters.locationId || ''}
      />

      {/* AI Reply Modal */}
      <AiReplyModal
        isOpen={aiModalOpen}
        onClose={() => {
          setAiModalOpen(false);
          setTargetReviewForAi(null);
        }}
        review={targetReviewForAi}
        onApplySuggestion={handleApplyAiSuggestion}
      />
    </div>
  );
}
