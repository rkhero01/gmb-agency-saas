import React from 'react';
import { MetricCard } from '../ui/MetricCard.jsx';

export function OverviewStats() {
  return (
    <div className="metrics-grid">
      <MetricCard
        label="Managed Clients"
        value="12"
        tag="Multi-Tenant"
        note="Active agency brand accounts"
        icon={<span style={{ fontSize: '1.2rem' }}>🏢</span>}
      />
      <MetricCard
        label="Total Locations"
        value="48"
        tag="Hierarchy Level 3"
        note="Physical & service branches"
        icon={<span style={{ fontSize: '1.2rem' }}>📍</span>}
      />
      <MetricCard
        label="GBP Listings"
        value="46"
        tag="Ready for OAuth"
        note="Google Business Profiles mapped"
        icon={<span style={{ fontSize: '1.2rem' }}>🌐</span>}
      />
      <MetricCard
        label="Pending Reviews"
        value="28"
        tag="Phase 5"
        note="Awaiting triage & response"
        icon={<span style={{ fontSize: '1.2rem' }}>⭐</span>}
      />
    </div>
  );
}
