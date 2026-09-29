-- ==============================================================================
-- Migration: 001_initial_schema.sql
-- Description: Core multi-tenant hierarchy tables for GMB Agency SaaS
-- Hierarchy: Agency -> Users -> Clients -> Locations -> Google Business Profiles
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. AGENCIES (Tenant Root)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    billing_email VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agencies_slug ON agencies(slug);

-- -----------------------------------------------------------------------------
-- 2. AGENCY USERS (Staff members belonging to an Agency)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_agency_user_email UNIQUE (agency_id, email),
    CONSTRAINT uq_users_id_agency UNIQUE (id, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_users_agency_id ON users(agency_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- -----------------------------------------------------------------------------
-- 3. CLIENTS (Brands/Businesses managed by an Agency)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_clients_id_agency UNIQUE (id, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_clients_agency_id ON clients(agency_id);

-- -----------------------------------------------------------------------------
-- 4. LOCATIONS (Physical store locations or service area businesses)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    client_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    store_code VARCHAR(100),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(50),
    country VARCHAR(10),
    phone VARCHAR(50),
    website_url VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING', 'SUSPENDED', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Enforce that client belongs to the exact same agency
    CONSTRAINT fk_locations_client FOREIGN KEY (client_id, agency_id)
        REFERENCES clients(id, agency_id) ON DELETE CASCADE,
    CONSTRAINT uq_locations_id_agency UNIQUE (id, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_locations_agency_id ON locations(agency_id);
CREATE INDEX IF NOT EXISTS idx_locations_client_id ON locations(client_id);

-- -----------------------------------------------------------------------------
-- 5. GOOGLE BUSINESS PROFILES (GBP metadata & credentials connection)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gmb_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    location_id UUID NOT NULL,
    google_account_id VARCHAR(255),
    google_location_id VARCHAR(255),
    resource_name VARCHAR(255),
    verification_status VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED',
    sync_status VARCHAR(50) NOT NULL DEFAULT 'IDLE' CHECK (sync_status IN ('IDLE', 'SYNCING', 'SUCCESS', 'FAILED')),
    last_synced_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Enforce location belongs to the same agency
    CONSTRAINT fk_gmb_profiles_location FOREIGN KEY (location_id, agency_id)
        REFERENCES locations(id, agency_id) ON DELETE CASCADE,
    CONSTRAINT uq_gmb_profiles_id_agency UNIQUE (id, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_gmb_profiles_agency_id ON gmb_profiles(agency_id);
CREATE INDEX IF NOT EXISTS idx_gmb_profiles_location_id ON gmb_profiles(location_id);
CREATE INDEX IF NOT EXISTS idx_gmb_profiles_google_loc ON gmb_profiles(google_location_id);

-- -----------------------------------------------------------------------------
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- Ensures isolation even if raw query omits agency_id filter
-- -----------------------------------------------------------------------------
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmb_profiles ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies can be activated in production sessions via:
-- SET LOCAL app.current_agency_id = '<agency_uuid>';
DROP POLICY IF EXISTS agency_isolation_clients ON clients;
CREATE POLICY agency_isolation_clients ON clients
    FOR ALL
    USING (agency_id = NULLIF(current_setting('app.current_agency_id', true), '')::uuid);

DROP POLICY IF EXISTS agency_isolation_locations ON locations;
CREATE POLICY agency_isolation_locations ON locations
    FOR ALL
    USING (agency_id = NULLIF(current_setting('app.current_agency_id', true), '')::uuid);

DROP POLICY IF EXISTS agency_isolation_gmb_profiles ON gmb_profiles;
CREATE POLICY agency_isolation_gmb_profiles ON gmb_profiles
    FOR ALL
    USING (agency_id = NULLIF(current_setting('app.current_agency_id', true), '')::uuid);
