import React, { useState, useEffect } from 'react';

export function LocationFormModal({
  isOpen,
  onClose,
  onSubmit,
  location = null,
  clientName = '',
  loading = false,
  error = null,
}) {
  const [name, setName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('US');
  const [timezone, setTimezone] = useState('America/New_York');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState('active');
  const [localError, setLocalError] = useState(null);

  const isEdit = Boolean(location && location.id);

  useEffect(() => {
    if (location) {
      setName(location.name || '');
      setAddressLine1(location.address_line1 || '');
      setAddressLine2(location.address_line2 || '');
      setCity(location.city || '');
      setState(location.state || '');
      setPostalCode(location.postal_code || '');
      setCountry(location.country || 'US');
      setTimezone(location.timezone || 'America/New_York');
      setPhone(location.phone || '');
      setWebsite(location.website || '');
      setStatus(location.status || 'active');
    } else {
      setName('');
      setAddressLine1('');
      setAddressLine2('');
      setCity('');
      setState('');
      setPostalCode('');
      setCountry('US');
      setTimezone('America/New_York');
      setPhone('');
      setWebsite('');
      setStatus('active');
    }
    setLocalError(null);
  }, [location, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError(null);

    if (!name.trim()) {
      setLocalError('Location name is required.');
      return;
    }

    const payload = {
      name: name.trim(),
      address_line1: addressLine1.trim() || null,
      address_line2: addressLine2.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      postal_code: postalCode.trim() || null,
      country: country.trim() || null,
      timezone: timezone.trim() || null,
      phone: phone.trim() || null,
      website: website.trim() || null,
      status,
    };

    onSubmit(payload);
  };

  const displayedError = error || localError;

  return (
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
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="panel-card"
        style={{
          width: '100%',
          maxWidth: 540,
          padding: 28,
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: 'var(--shadow-lg)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
            {isEdit ? 'Edit Location Branch' : 'Add Physical Location'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.3rem',
              cursor: 'pointer',
              padding: '2px 8px',
            }}
          >
            ×
          </button>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
          {clientName ? (
            <>
              Configuring location under brand <strong style={{ color: '#ffffff' }}>{clientName}</strong>.
            </>
          ) : (
            'Branch details and geographic address coordinates.'
          )}
        </p>

        {displayedError && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 'var(--radius-md)',
              color: '#fca5a5',
              fontSize: '0.85rem',
              marginBottom: 16,
            }}
          >
            ⚠ {displayedError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Location Name */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: 5,
              }}
            >
              LOCATION / BRANCH NAME <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Midtown Clinic & Dental Spa"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.85rem',
              }}
            />
          </div>

          {/* Address Line 1 */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: 5,
              }}
            >
              STREET ADDRESS
            </label>
            <input
              type="text"
              placeholder="e.g. 500 5th Avenue"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.85rem',
              }}
            />
          </div>

          {/* Address Line 2 */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: 5,
              }}
            >
              SUITE / APARTMENT / FLOOR
            </label>
            <input
              type="text"
              placeholder="e.g. Suite 1800"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.85rem',
              }}
            />
          </div>

          {/* City, State, Postal Code */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr', gap: 10 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 5,
                }}
              >
                CITY
              </label>
              <input
                type="text"
                placeholder="New York"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 5,
                }}
              >
                STATE
              </label>
              <input
                type="text"
                placeholder="NY"
                value={state}
                onChange={(e) => setState(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 5,
                }}
              >
                POSTAL CODE
              </label>
              <input
                type="text"
                placeholder="10110"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>

          {/* Country & Timezone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 10 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 5,
                }}
              >
                COUNTRY CODE
              </label>
              <input
                type="text"
                placeholder="US"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 5,
                }}
              >
                TIMEZONE
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              >
                <option value="America/New_York">America/New_York (Eastern)</option>
                <option value="America/Chicago">America/Chicago (Central)</option>
                <option value="America/Denver">America/Denver (Mountain)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>

          {/* Phone & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 5,
                }}
              >
                LOCATION PHONE
              </label>
              <input
                type="tel"
                placeholder="+1 (212) 555-0199"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 5,
                }}
              >
                STATUS
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', minWidth: 100 }}
            >
              {loading ? 'Saving...' : isEdit ? 'Update Location' : 'Create Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
