import React from 'react';

export function ReviewFiltersBar({
  filters,
  onFilterChange,
  clients = [],
  locations = [],
  onOpenSyncModal,
  canSync = false,
  totalReviews = 0,
}) {
  const filteredLocations = filters.clientId
    ? locations.filter((loc) => loc.client_id === filters.clientId)
    : locations;

  const handleReset = () => {
    onFilterChange({
      clientId: '',
      locationId: '',
      starRating: '',
      replyStatus: '',
      status: '',
      search: '',
      sortBy: 'review_create_time',
      sortOrder: 'desc',
    });
  };

  const hasActiveFilters = Boolean(
    filters.clientId ||
      filters.locationId ||
      filters.starRating ||
      filters.replyStatus ||
      filters.status ||
      filters.search ||
      filters.sortBy !== 'review_create_time' ||
      filters.sortOrder !== 'desc'
  );

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Top Row: Search Bar & Primary Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            placeholder="Search reviews by comment text or reviewer name..."
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: '#ffffff',
              fontSize: '0.85rem',
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-subtle)',
              fontSize: '0.9rem',
              pointerEvents: 'none',
            }}
          >
            🔍
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              Reset Filters
            </button>
          )}

          {canSync && (
            <button
              onClick={onOpenSyncModal}
              className="btn btn-primary btn-sm"
              style={{
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
              }}
            >
              <span>🔄</span>
              <span>Sync Google Reviews</span>
            </button>
          )}
        </div>
      </div>

      {/* Second Row: Detailed Dropdown Filters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 12,
        }}
      >
        {/* Client Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-subtle)', marginBottom: 4 }}>
            Client Brand
          </label>
          <select
            value={filters.clientId || ''}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                clientId: e.target.value,
                locationId: '', // Reset location when client changes
              })
            }
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: '#ffffff',
              fontSize: '0.8rem',
            }}
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Location Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-subtle)', marginBottom: 4 }}>
            Location Branch
          </label>
          <select
            value={filters.locationId || ''}
            onChange={(e) => onFilterChange({ ...filters, locationId: e.target.value })}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: '#ffffff',
              fontSize: '0.8rem',
            }}
          >
            <option value="">All Locations</option>
            {filteredLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.city ? `(${loc.city})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Star Rating Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-subtle)', marginBottom: 4 }}>
            Star Rating
          </label>
          <select
            value={filters.starRating || ''}
            onChange={(e) => onFilterChange({ ...filters, starRating: e.target.value })}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: '#ffffff',
              fontSize: '0.8rem',
            }}
          >
            <option value="">All Stars (1 - 5)</option>
            <option value="5">★★★★★ (5 Stars)</option>
            <option value="4">★★★★☆ (4 Stars)</option>
            <option value="3">★★★☆☆ (3 Stars)</option>
            <option value="2">★★☆☆☆ (2 Stars)</option>
            <option value="1">★☆☆☆☆ (1 Star)</option>
          </select>
        </div>

        {/* Reply Workflow Status */}
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-subtle)', marginBottom: 4 }}>
            Reply Status
          </label>
          <select
            value={filters.replyStatus || ''}
            onChange={(e) => onFilterChange({ ...filters, replyStatus: e.target.value })}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: '#ffffff',
              fontSize: '0.8rem',
            }}
          >
            <option value="">All Reply States</option>
            <option value="unreplied">Unreplied</option>
            <option value="ai_suggested">AI Suggested</option>
            <option value="draft">Draft Saved</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </select>
        </div>

        {/* Review Processing Status */}
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-subtle)', marginBottom: 4 }}>
            Inbox Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: '#ffffff',
              fontSize: '0.8rem',
            }}
          >
            <option value="">All Inbox States</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="archived">Archived</option>
            <option value="flagged">Flagged</option>
          </select>
        </div>

        {/* Sort Field & Order */}
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-subtle)', marginBottom: 4 }}>
            Sort Order
          </label>
          <select
            value={`${filters.sortBy || 'review_create_time'}_${filters.sortOrder || 'desc'}`}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'date_desc') {
                onFilterChange({ ...filters, sortBy: 'review_create_time', sortOrder: 'desc' });
              } else if (val === 'date_asc') {
                onFilterChange({ ...filters, sortBy: 'review_create_time', sortOrder: 'asc' });
              } else if (val === 'rating_desc') {
                onFilterChange({ ...filters, sortBy: 'star_rating', sortOrder: 'desc' });
              } else if (val === 'rating_asc') {
                onFilterChange({ ...filters, sortBy: 'star_rating', sortOrder: 'asc' });
              }
            }}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: '#ffffff',
              fontSize: '0.8rem',
            }}
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="rating_desc">Highest Rating</option>
            <option value="rating_asc">Lowest Rating</option>
          </select>
        </div>
      </div>
    </div>
  );
}
