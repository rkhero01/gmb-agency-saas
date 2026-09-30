import React from 'react';
import { MetricCard } from '../ui/MetricCard.jsx';

export function ReviewStatsHeader({ stats, loading }) {
  if (loading && !stats) {
    return (
      <div className="metrics-grid" style={{ marginBottom: 24 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="metric-card"
            style={{ minHeight: 110, opacity: 0.6, animation: 'pulse 1.5s infinite' }}
          >
            <div style={{ height: 14, width: 80, background: 'var(--border-subtle)', borderRadius: 4, marginBottom: 12 }} />
            <div style={{ height: 28, width: 60, background: 'var(--border-subtle)', borderRadius: 4 }} />
          </div>
        ))}
      </div>
    );
  }

  const totalReviews =
    stats?.total_reviews ?? stats?.totalReviews ?? stats?.total ?? 0;

  const averageRatingValue =
    stats?.average_rating ?? stats?.averageRating;

  const averageRating =
    averageRatingValue != null
      ? Number(averageRatingValue).toFixed(1)
      : '0.0';

  const unrepliedCount =
    stats?.unreplied_count ?? stats?.unrepliedCount ?? 0;

  const pendingApprovalCount =
    stats?.pending_reply_count ?? stats?.pendingApprovalCount ?? 0;

  const publishedRepliesCount =
    stats?.published_count ?? stats?.publishedRepliesCount ?? 0;

  const count5 =
    stats?.rating_breakdown?.[5] ??
    stats?.count_5_star ??
    stats?.ratingDistribution?.fiveStar ??
    0;

  const count4 =
    stats?.rating_breakdown?.[4] ??
    stats?.count_4_star ??
    stats?.ratingDistribution?.fourStar ??
    0;

  const count3 =
    stats?.rating_breakdown?.[3] ??
    stats?.count_3_star ??
    stats?.ratingDistribution?.threeStar ??
    0;

  const count2 =
    stats?.rating_breakdown?.[2] ??
    stats?.count_2_star ??
    stats?.ratingDistribution?.twoStar ??
    0;

  const count1 =
    stats?.rating_breakdown?.[1] ??
    stats?.count_1_star ??
    stats?.ratingDistribution?.oneStar ??
    0;

  const getPercentage = (count) => {
    if (!totalReviews || totalReviews === 0) return 0;
    return Math.round((count / totalReviews) * 100);
  };

  return (
    <div style={{ marginBottom: 24 }}>
      {/* 4 Core Summary Metrics */}
      <div className="metrics-grid" style={{ marginBottom: 20 }}>
        <MetricCard
          label="Total Customer Reviews"
          value={totalReviews}
          note="Synced from Google Business Profiles"
          tag="All Time"
          icon={
            <span style={{ fontSize: '1.2rem', color: '#6366f1' }}>⭐</span>
          }
        />

        <MetricCard
          label="Average Star Rating"
          value={averageRating}
          note={`${totalReviews} total verified reviews`}
          tag={Number(averageRating) >= 4.0 ? 'High Performing' : 'Needs Attention'}
          icon={
            <span style={{ fontSize: '1.2rem', color: '#f59e0b' }}>✨</span>
          }
        />

        <MetricCard
          label="Unreplied Reviews"
          value={unrepliedCount}
          note={unrepliedCount > 0 ? 'Requires agency response' : 'Inbox zero achieved'}
          tag={unrepliedCount > 0 ? 'Action Needed' : 'Complete'}
          icon={
            <span style={{ fontSize: '1.2rem', color: unrepliedCount > 0 ? '#ef4444' : '#10b981' }}>
              💬
            </span>
          }
        />

        <MetricCard
          label="Pending Approvals"
          value={pendingApprovalCount}
          note={`${publishedRepliesCount} published to Google`}
          tag={pendingApprovalCount > 0 ? 'Manager Review' : 'Up to Date'}
          icon={
            <span style={{ fontSize: '1.2rem', color: '#8b5cf6' }}>🛡️</span>
          }
        />
      </div>

      {/* Star Rating Distribution Mini-Bar */}
      {totalReviews > 0 && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
              }}
            >
              Star Rating Breakdown
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
              Overall Sentiment: {Number(averageRating) >= 4.0 ? 'Positive (★ 4.0+)' : 'Mixed'}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 16,
            }}
          >
            {[
              { stars: '5★', count: count5, color: '#10b981' },
              { stars: '4★', count: count4, color: '#6366f1' },
              { stars: '3★', count: count3, color: '#f59e0b' },
              { stars: '2★', count: count2, color: '#f97316' },
              { stars: '1★', count: count1, color: '#ef4444' },
            ].map((item) => {
              const pct = getPercentage(item.count);
              return (
                <div key={item.stars} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ fontWeight: 600, color: '#ffffff' }}>{item.stars}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: 'var(--radius-full)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: item.color,
                        borderRadius: 'var(--radius-full)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
