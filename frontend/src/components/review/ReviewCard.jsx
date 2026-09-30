import React, { useState } from 'react';
import { ReplyWorkflowPanel } from './ReplyWorkflowPanel.jsx';
import { updateReviewStatus } from '../../services/api.js';

export function ReviewCard({
  review,
  currentUser,
  onReviewUpdated,
  onOpenAiModal,
}) {
  const [expanded, setExpanded] = useState(
    review.reply_status === 'unreplied' || review.reply_status === 'pending_approval'
  );
  const [statusUpdating, setStatusUpdating] = useState(false);

  const role = currentUser?.role?.toLowerCase() || 'viewer';
  const canUpdateStatus = ['owner', 'admin', 'manager', 'specialist'].includes(role);

  const reviewerName = review.reviewer_name || 'Anonymous Reviewer';
  const reviewerInitials = reviewerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const starRating = Number(review.star_rating) || 5;

  const handleStatusChange = async (newStatus) => {
    if (!canUpdateStatus || statusUpdating || newStatus === review.status) return;
    setStatusUpdating(true);
    try {
      await updateReviewStatus(review.id, newStatus);
      onReviewUpdated?.();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setStatusUpdating(false);
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'unread':
        return { bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: 'rgba(99, 102, 241, 0.3)' };
      case 'read':
        return { bg: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: 'var(--border-subtle)' };
      case 'flagged':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
      case 'archived':
        return { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', border: 'rgba(100, 116, 139, 0.3)' };
      default:
        return { bg: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-subtle)', border: 'var(--border-subtle)' };
    }
  };

  const statusStyle = getStatusBadgeStyle(review.status);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Review Header: Reviewer Info, Stars, Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 12,
        }}
      >
        {/* Left: Avatar & Reviewer info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.25))',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            {reviewerInitials}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                {reviewerName}
              </span>
              {review.is_anonymous && (
                <span style={{ fontSize: '0.65rem', color: 'var(--text-subtle)' }}>
                  (Anonymous)
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: 2 }}>
              {review.review_create_time
                ? new Date(review.review_create_time).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Date not specified'}
            </div>
          </div>
        </div>

        {/* Right: Star Rating & Inbox Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Star Rating Display */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              padding: '4px 8px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {[1, 2, 3, 4, 5].map((s) => (
              <span
                key={s}
                style={{
                  fontSize: '0.85rem',
                  color: s <= starRating ? '#f59e0b' : 'rgba(255, 255, 255, 0.15)',
                }}
              >
                ★
              </span>
            ))}
            <span
              style={{
                marginLeft: 4,
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#f59e0b',
              }}
            >
              {starRating}.0
            </span>
          </div>

          {/* Review Status Control / Tag */}
          {canUpdateStatus ? (
            <select
              value={review.status || 'unread'}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={statusUpdating}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: statusStyle.bg,
                color: statusStyle.color,
                border: `1px solid ${statusStyle.border}`,
                cursor: 'pointer',
              }}
            >
              <option value="unread">Inbox: Unread</option>
              <option value="read">Inbox: Read</option>
              <option value="archived">Inbox: Archived</option>
              <option value="flagged">Inbox: Flagged</option>
            </select>
          ) : (
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: statusStyle.bg,
                color: statusStyle.color,
                border: `1px solid ${statusStyle.border}`,
              }}
            >
              {review.status || 'unread'}
            </span>
          )}
        </div>
      </div>

      {/* Review Comment Body */}
      <div style={{ marginBottom: 14 }}>
        {review.comment ? (
          <p
            style={{
              fontSize: '0.9rem',
              lineHeight: 1.6,
              color: 'var(--text-main)',
              margin: 0,
            }}
          >
            "{review.comment}"
          </p>
        ) : (
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-subtle)',
              fontStyle: 'italic',
              margin: 0,
            }}
          >
            (Customer gave a {starRating}-star rating with no written comment text)
          </p>
        )}
      </div>

      {/* Metadata Badges: Location, Client, Google Sync */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          fontSize: '0.75rem',
          color: 'var(--text-subtle)',
        }}
      >
        {review.location_name && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            📍 {review.location_name}
            {review.location_city ? ` (${review.location_city})` : ''}
          </span>
        )}

        {review.client_name && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            🏢 {review.client_name}
          </span>
        )}

        {review.google_review_id && (
          <span
            style={{
              fontSize: '0.7rem',
              fontFamily: 'JetBrains Mono',
              color: 'var(--text-disabled)',
            }}
          >
            ID: {review.google_review_id.slice(-10)}
          </span>
        )}

        {/* Toggle Reply Drawer Button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="btn btn-secondary btn-sm"
          style={{
            marginLeft: 'auto',
            fontSize: '0.75rem',
            padding: '3px 8px',
            borderColor: expanded ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-subtle)',
          }}
        >
          {expanded ? '▲ Hide Reply Workflow' : '▼ Manage Reply'}
        </button>
      </div>

      {/* Accordion Reply Workflow Panel */}
      {expanded && (
        <ReplyWorkflowPanel
          review={review}
          currentUser={currentUser}
          onReplyUpdated={onReviewUpdated}
          onOpenAiModal={onOpenAiModal}
        />
      )}
    </div>
  );
}
