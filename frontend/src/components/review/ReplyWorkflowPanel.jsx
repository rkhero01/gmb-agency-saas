import React, { useState, useEffect } from 'react';
import {
  saveReplyDraft,
  submitReplyForApproval,
  approveReply,
  rejectReply,
  publishReply,
  deletePublishedReply,
} from '../../services/api.js';

export function ReplyWorkflowPanel({
  review,
  currentUser,
  onReplyUpdated,
  onOpenAiModal,
}) {
  const reply = review.reply || null;
  const replyStatus = review.reply_status || 'unreplied';

  const [draftText, setDraftText] = useState(
    reply?.draft_reply || reply?.suggested_reply || ''
  );
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Loading states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Sync draftText if review changes
  useEffect(() => {
    setDraftText(reply?.draft_reply || reply?.suggested_reply || '');
    setShowRejectInput(false);
    setShowDeleteConfirm(false);
    setActionError(null);
  }, [reply?.draft_reply, reply?.suggested_reply, review.id]);

  // Role permissions
  const role = currentUser?.role?.toLowerCase() || 'viewer';
  const isViewer = role === 'viewer';
  const isSpecialist = role === 'specialist';
  const isManagerOrAbove = ['owner', 'admin', 'manager'].includes(role);

  const canEditDraft = !isViewer;
  const canSubmitApproval = !isViewer;
  const canApprove = isManagerOrAbove;
  const canReject = isManagerOrAbove;
  const canDelete = isManagerOrAbove;
  const canGenerateAi = !isViewer;

  // Specialist may only publish if status is already 'approved'
  const canPublish = isManagerOrAbove || (isSpecialist && replyStatus === 'approved');

  const executeAction = async (actionFn, successMsg) => {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await actionFn();
      setActionSuccess(successMsg);
      setTimeout(() => setActionSuccess(null), 4000);
      onReplyUpdated?.();
    } catch (err) {
      setActionError(err.message || 'Workflow operation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveDraft = () => {
    if (!draftText.trim()) {
      setActionError('Draft text cannot be empty.');
      return;
    }
    executeAction(
      () => saveReplyDraft(review.id, draftText.trim()),
      'Reply draft saved successfully.'
    );
  };

  const handleSubmitApproval = () => {
    executeAction(
      () => submitReplyForApproval(review.id),
      'Reply submitted for manager approval.'
    );
  };

  const handleApprove = () => {
    executeAction(
      () => approveReply(review.id),
      'Reply approved! Ready for Google publication.'
    );
  };

  const handleReject = () => {
    executeAction(
      () => rejectReply(review.id, rejectReason.trim() || undefined),
      'Reply rejected and reverted to draft.'
    );
    setShowRejectInput(false);
    setRejectReason('');
  };

  const handlePublish = () => {
    executeAction(
      () => publishReply(review.id),
      'Reply published to Google Business Profile successfully!'
    );
  };

  const handleDeletePublished = () => {
    executeAction(
      () => deletePublishedReply(review.id),
      'Published reply deleted from Google Business Profile.'
    );
    setShowDeleteConfirm(false);
  };

  const getWorkflowBadge = () => {
    switch (replyStatus) {
      case 'published':
        return { label: 'Published on Google', bg: 'var(--success-bg)', color: 'var(--success)' };
      case 'approved':
        return { label: 'Approved (Ready to Publish)', bg: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' };
      case 'pending_approval':
        return { label: 'Pending Manager Approval', bg: 'var(--warning-bg)', color: 'var(--warning)' };
      case 'draft':
        return { label: 'Draft In Progress', bg: 'rgba(255, 255, 255, 0.08)', color: '#ffffff' };
      case 'ai_suggested':
      case 'suggested':
        return { label: 'AI Suggestion Generated', bg: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd' };
      default:
        return { label: 'Unreplied', bg: 'rgba(255, 255, 255, 0.04)', color: 'var(--text-subtle)' };
    }
  };

  const badge = getWorkflowBadge();

  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Workflow Status Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Reply Status:
          </span>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 700,
              backgroundColor: badge.bg,
              color: badge.color,
              border: `1px solid ${badge.color}33`,
            }}
          >
            {badge.label}
          </span>
        </div>

        {/* AI Helper Trigger */}
        {canGenerateAi && replyStatus !== 'published' && (
          <button
            onClick={() => onOpenAiModal(review)}
            disabled={actionLoading}
            className="btn btn-secondary btn-sm"
            style={{
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderColor: 'rgba(99, 102, 241, 0.3)',
              color: '#a5b4fc',
            }}
          >
            <span>✨</span>
            <span>AI Suggestion</span>
          </button>
        )}
      </div>

      {/* Action Messages */}
      {actionSuccess && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--success-bg)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#6ee7b7',
            fontSize: '0.8rem',
          }}
        >
          ✓ {actionSuccess}
        </div>
      )}

      {actionError && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '0.8rem',
          }}
        >
          ✕ {actionError}
        </div>
      )}

      {/* If Published: Show Live Published Reply Card */}
      {replyStatus === 'published' ? (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>
              ✓ Published Business Response
            </span>
            {reply?.published_at && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                Published: {new Date(reply.published_at).toLocaleString()}
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-main)',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              margin: 0,
            }}
          >
            {reply?.final_published_reply ||
              review.external_reply_comment ||
              reply?.draft_reply ||
              review.comment}
          </p>

          {/* Delete Action (Manager/Admin/Owner only) */}
          {canDelete && (
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              {showDeleteConfirm ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
                    Confirm deletion from Google?
                  </span>
                  <button
                    onClick={handleDeletePublished}
                    disabled={actionLoading}
                    className="btn btn-sm"
                    style={{
                      background: 'var(--danger)',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                    }}
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={actionLoading}
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: '0.75rem',
                    color: '#f87171',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                  }}
                >
                  🗑️ Delete Published Reply
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Draft / Workflow Editing Area */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isViewer ? (
            <div
              style={{
                padding: '12px 14px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                fontStyle: 'italic',
              }}
            >
              🔒 Read-only access: Viewer role cannot compose or mutate review replies.
              {draftText && (
                <div style={{ marginTop: 8, fontStyle: 'normal', color: 'var(--text-main)' }}>
                  Current Draft: "{draftText}"
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Draft Textarea */}
              <div style={{ position: 'relative' }}>
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder="Compose official agency reply to customer review..."
                  rows={4}
                  maxLength={5000}
                  disabled={actionLoading}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    resize: 'vertical',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: 4,
                    fontSize: '0.7rem',
                    color: draftText.length > 4500 ? '#f59e0b' : 'var(--text-subtle)',
                  }}
                >
                  {draftText.length} / 5000 characters
                </div>
              </div>

              {/* Reject Reason Input (if rejection initiated) */}
              {showRejectInput && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fca5a5' }}>
                    Rejection Feedback Reason:
                  </label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Please soften tone regarding return policy..."
                    maxLength={500}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={actionLoading}
                      className="btn btn-sm"
                      style={{
                        background: 'var(--danger)',
                        color: '#ffffff',
                        fontSize: '0.75rem',
                      }}
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                {/* Left Side: Save Draft */}
                <div>
                  {canEditDraft && (
                    <button
                      onClick={handleSaveDraft}
                      disabled={actionLoading || !draftText.trim()}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.8rem' }}
                    >
                      💾 Save Draft
                    </button>
                  )}
                </div>

                {/* Right Side: Approval & Publish Flow */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {/* Submit for Approval */}
                  {canSubmitApproval &&
                    ['unreplied', 'draft', 'suggested', 'ai_suggested'].includes(replyStatus) && (
                      <button
                        onClick={handleSubmitApproval}
                        disabled={actionLoading || !draftText.trim()}
                        className="btn btn-secondary btn-sm"
                        style={{
                          fontSize: '0.8rem',
                          borderColor: 'rgba(245, 158, 11, 0.4)',
                          color: '#fcd34d',
                        }}
                      >
                        📤 Submit for Approval
                      </button>
                    )}

                  {/* Manager Approval Controls */}
                  {canApprove && replyStatus === 'pending_approval' && (
                    <>
                      <button
                        onClick={() => setShowRejectInput(true)}
                        disabled={actionLoading}
                        className="btn btn-secondary btn-sm"
                        style={{
                          fontSize: '0.8rem',
                          color: '#f87171',
                          borderColor: 'rgba(239, 68, 68, 0.3)',
                        }}
                      >
                        ✕ Reject
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="btn btn-sm"
                        style={{
                          background: '#8b5cf6',
                          color: '#ffffff',
                          fontSize: '0.8rem',
                        }}
                      >
                        ✓ Approve Reply
                      </button>
                    </>
                  )}

                  {/* Publish to Google Business Profile */}
                  {canPublish ? (
                    <button
                      onClick={handlePublish}
                      disabled={actionLoading || !draftText.trim()}
                      className="btn btn-primary btn-sm"
                      style={{
                        fontSize: '0.8rem',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                      }}
                    >
                      🚀 Publish to Google
                    </button>
                  ) : isSpecialist && replyStatus !== 'approved' ? (
                    <button
                      disabled
                      title="Specialists may only publish replies that have been approved by a Manager, Admin, or Owner."
                      className="btn btn-secondary btn-sm"
                      style={{
                        fontSize: '0.8rem',
                        opacity: 0.5,
                        cursor: 'not-allowed',
                      }}
                    >
                      🔒 Approval Required to Publish
                    </button>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
