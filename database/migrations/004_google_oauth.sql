-- ==============================================================================
-- Migration: 004_google_oauth.sql
-- Description: Phase 4 Google Cloud OAuth 2.0 & Token Storage for GBP Integration
-- Multi-tenant isolation enforced via agency_id foreign key, compound constraint, and RLS
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- 1. GOOGLE OAUTH ACCOUNTS (Multi-Tenant OAuth Credential Store)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS google_oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    google_account_id VARCHAR(255),
    google_email VARCHAR(255),
    google_name VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMPTZ,
    scopes TEXT[],
    connection_status VARCHAR(50) NOT NULL DEFAULT 'connected' 
        CHECK (connection_status IN ('connected', 'disconnected', 'expired', 'error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Enforce single active Google OAuth connection record per agency tenant
    CONSTRAINT uq_google_oauth_agency UNIQUE (agency_id),
    CONSTRAINT uq_google_oauth_id_agency UNIQUE (id, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_google_oauth_agency_id ON google_oauth_accounts(agency_id);
CREATE INDEX IF NOT EXISTS idx_google_oauth_google_id ON google_oauth_accounts(google_account_id);
CREATE INDEX IF NOT EXISTS idx_google_oauth_status ON google_oauth_accounts(connection_status);

-- -----------------------------------------------------------------------------
-- 2. ROW-LEVEL SECURITY (RLS) FOR GOOGLE OAUTH ACCOUNTS
-- -----------------------------------------------------------------------------
ALTER TABLE google_oauth_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_google_oauth_accounts ON google_oauth_accounts;
CREATE POLICY tenant_isolation_google_oauth_accounts ON google_oauth_accounts
    FOR ALL
    USING (
        agency_id = NULLIF(current_setting('app.current_agency_id', true), '')::uuid
    );

-- -----------------------------------------------------------------------------
-- 3. ENHANCE GOOGLE BUSINESS PROFILES TABLE (Optional Metadata & Sync Timestamp)
-- -----------------------------------------------------------------------------
ALTER TABLE google_business_profiles ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE google_business_profiles ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
