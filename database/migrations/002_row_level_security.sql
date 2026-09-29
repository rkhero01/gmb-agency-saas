-- ==============================================================================
-- Migration: 002_row_level_security.sql
-- Description: Row-Level Security (RLS) policies for tenant isolation
-- ==============================================================================

-- Enable RLS on multi-tenant tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_business_profiles ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Policy: Tenant Isolation for users
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation_users ON users;
CREATE POLICY tenant_isolation_users ON users
    FOR ALL
    USING (
        agency_id = NULLIF(current_setting('app.current_agency_id', true), '')::uuid
    );

-- -----------------------------------------------------------------------------
-- Policy: Tenant Isolation for clients
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation_clients ON clients;
CREATE POLICY tenant_isolation_clients ON clients
    FOR ALL
    USING (
        agency_id = NULLIF(current_setting('app.current_agency_id', true), '')::uuid
    );

-- -----------------------------------------------------------------------------
-- Policy: Tenant Isolation for locations
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation_locations ON locations;
CREATE POLICY tenant_isolation_locations ON locations
    FOR ALL
    USING (
        agency_id = NULLIF(current_setting('app.current_agency_id', true), '')::uuid
    );

-- -----------------------------------------------------------------------------
-- Policy: Tenant Isolation for google_business_profiles
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation_google_business_profiles ON google_business_profiles;
CREATE POLICY tenant_isolation_google_business_profiles ON google_business_profiles
    FOR ALL
    USING (
        agency_id = NULLIF(current_setting('app.current_agency_id', true), '')::uuid
    );
