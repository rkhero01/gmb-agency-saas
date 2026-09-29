-- ==============================================================================
-- Migration: 001_core_schema.sql
-- Description: Phase 1 Core Multi-Tenant Database Schema
-- Entities: agencies -> users -> clients -> locations -> google_business_profiles
-- ==============================================================================

-- Enable standard UUID extensions if available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. AGENCIES (Tenant Root)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agencies_slug ON agencies(slug);
CREATE INDEX IF NOT EXISTS idx_agencies_status ON agencies(status);

-- -----------------------------------------------------------------------------
-- 2. USERS (Agency Staff / Team Members)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'manager', 'specialist', 'viewer')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Email uniqueness enforced within the agency boundary
    CONSTRAINT uq_agency_user_email UNIQUE (agency_id, email),
    -- Compound unique key to support multi-tenant relational constraints
    CONSTRAINT uq_users_id_agency UNIQUE (id, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_users_agency_id ON users(agency_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- -----------------------------------------------------------------------------
-- 3. CLIENTS (Agency Brand Accounts / Portfolios)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    business_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Compound unique constraint for foreign key references
    CONSTRAINT uq_clients_id_agency UNIQUE (id, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_clients_agency_id ON clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

-- -----------------------------------------------------------------------------
-- 4. LOCATIONS (Physical Branches / Service Locations)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    client_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(50),
    country VARCHAR(10),
    timezone VARCHAR(100),
    phone VARCHAR(50),
    website VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Enforce database-level integrity: location CANNOT reference a client from another agency!
    CONSTRAINT fk_locations_client FOREIGN KEY (client_id, agency_id)
        REFERENCES clients(id, agency_id) ON DELETE CASCADE,
    CONSTRAINT uq_locations_id_agency UNIQUE (id, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_locations_agency_id ON locations(agency_id);
CREATE INDEX IF NOT EXISTS idx_locations_client_id ON locations(client_id);
CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status);

-- -----------------------------------------------------------------------------
-- 5. GOOGLE BUSINESS PROFILES (Foundational Database Table - No Mock API)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS google_business_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    client_id UUID NOT NULL,
    location_id UUID NOT NULL,
    google_account_id VARCHAR(255),
    google_location_id VARCHAR(255),
    profile_name VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
    connection_status VARCHAR(50) NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'pending', 'error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Enforce location and client belong to the exact same agency
    CONSTRAINT fk_gbp_location FOREIGN KEY (location_id, agency_id)
        REFERENCES locations(id, agency_id) ON DELETE CASCADE,
    CONSTRAINT fk_gbp_client FOREIGN KEY (client_id, agency_id)
        REFERENCES clients(id, agency_id) ON DELETE CASCADE,
    CONSTRAINT uq_gbp_location_id UNIQUE (location_id),
    CONSTRAINT uq_google_business_profiles_id_agency UNIQUE (id, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_gbp_agency_id ON google_business_profiles(agency_id);
CREATE INDEX IF NOT EXISTS idx_gbp_client_id ON google_business_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_gbp_location_id ON google_business_profiles(location_id);
CREATE INDEX IF NOT EXISTS idx_gbp_google_loc ON google_business_profiles(google_location_id);
