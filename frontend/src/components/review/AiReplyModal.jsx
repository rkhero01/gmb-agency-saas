import React, { useState } from 'react';
import { generateAiSuggestion } from '../../services/api.js';

const TONE_OPTIONS = [
  { id: 'professional', label: 'Professional', desc: 'Courteous, polished, and brand-safe' },
  { id: 'friendly', label: 'Friendly', desc: 'Warm, personable, and welcoming' },
  { id: 'empathetic', label: 'Empathetic', desc: 'Ideal for critical reviews or complaints' },
  { id: 'concise', label: 'Concise', desc: 'Direct, brief, and to the point' },
];

export function AiReplyModal({
  isOpen,
  onClose,
  review,
  onApplySuggestion,
}) {
  const [tone, setTone] = useState('professional');
  const [customInstructions, setCustomInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen || !review) return null;

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);

    try {
      const result = await generateAiSuggestion(review.id, {
        tone,
        customInstructions: customInstructions.trim() || undefined,
      });

      setSuggestion(result);
    } catch (err) {
      setError(err.message || 'Failed to generate AI suggestion.');
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    if (suggestion?.suggestedReply) {
      onApplySuggestion(suggestion.suggestedReply);
      onClose();
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
        if (e.target === e.currentTarget && !generating) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: 620,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
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
            <span style={{ fontSize: '1.25rem' }}>✨</span>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                AI Advisory Reply Generator
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Advisory only • Draft is reviewed and submitted by your team
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={generating}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-subtle)',
              fontSize: '1.2rem',
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {error && (
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
              {error}
            </div>
          )}

          {/* Original Review Snippet */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                {review.reviewer_name || 'Anonymous Reviewer'}
              </span>
              <span style={{ color: '#f59e0b', fontSize: '0.85rem' }}>
                {'★'.repeat(review.star_rating || 5)}
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
              "{review.comment || 'No review comment text provided.'}"
            </p>
          </div>

          {/* Tone Selector */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-main)',
                marginBottom: 8,
              }}
            >
              Response Tone
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {TONE_OPTIONS.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${
                      tone === t.id ? 'var(--primary)' : 'var(--border-subtle)'
                    }`,
                    background: tone === t.id ? 'var(--primary-subtle)' : 'var(--bg-input)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: tone === t.id ? '#ffffff' : 'var(--text-main)',
                    }}
                  >
                    {t.label}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: 2 }}>
                    {t.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Instructions */}
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
              Custom Instructions (Optional)
            </label>
            <input
              type="text"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g. mention our 10% next-visit discount, ask them to email support@brand.com"
              maxLength={500}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.85rem',
              }}
            />
          </div>

          {/* Generate Action Button */}
          <div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '10px 16px',
                fontSize: '0.85rem',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              }}
            >
              {generating ? 'Crafting Advisory Suggestion...' : '⚡ Generate AI Suggestion'}
            </button>
          </div>

          {/* AI Output Preview */}
          {suggestion && (
            <div
              style={{
                marginTop: 6,
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#818cf8',
                    letterSpacing: '0.05em',
                  }}
                >
                  Suggested Draft Output
                </span>
                {suggestion.detectedSentiment && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Sentiment: {suggestion.detectedSentiment}
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  color: '#ffffff',
                  whiteSpace: 'pre-wrap',
                  background: 'rgba(0, 0, 0, 0.25)',
                  padding: 14,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {suggestion.suggestedReply}
              </div>

              {suggestion.reasoning && (
                <div style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                  💡 <em>{suggestion.reasoning}</em>
                </div>
              )}
            </div>
          )}
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
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!suggestion?.suggestedReply}
            className="btn btn-primary"
            style={{
              fontSize: '0.85rem',
              opacity: !suggestion?.suggestedReply ? 0.6 : 1,
            }}
          >
            ✓ Use in Reply Draft
          </button>
        </div>
      </div>
    </div>
  );
}
