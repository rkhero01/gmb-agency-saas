-- ==============================================================================
-- Migration: 003_auth_and_team_rbac.sql
-- Description: Phase 2 Authentication & Team RBAC Enhancements
-- Adds user login tracking, security locking fields, and performance indexes
-- ==============================================================================

-- 1. Add authentication & security tracking columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- 2. Add composite indexes for team member management and role checks
CREATE INDEX IF NOT EXISTS idx_users_agency_role ON users(agency_id, role);
CREATE INDEX IF NOT EXISTS idx_users_agency_status ON users(agency_id, status);
