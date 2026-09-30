-- ==============================================================================
-- Migration: 005_reviews_and_replies.sql
-- Description: Phase 5 Review Management & AI Reply Workflow
-- Multi-tenant isolation enforced via agency_id foreign keys, compound constraints, and RLS
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- 1. REVIEWS TABLE (Customer feedback synchronized from Google Business Profile)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    client_id UUID NOT NULL,
    location_id UUID NOT NULL,
    google_review_id VARCHAR(255) NOT NULL,
    reviewer_name VARCHAR(255),
    reviewer_photo_url TEXT,
    is_anonymous BOOLEAN NOT NULL DEFAULT false,
    star_rating INT NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
    original_rating_enum VARCHAR(20) NOT NULL CHECK (original_rating_enum IN ('ONE', 'TWO', 'THREE', 'FOUR', 'FIVE')),
    comment TEXT,
    review_create_time TIMESTAMPTZ NOT NULL,
    review_update_time TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'unread' 
        CHECK (status IN ('unread', 'read', 'archived', 'flagged')),
    reply_status VARCHAR(50) NOT NULL DEFAULT 'unreplied' 
        CHECK (reply_status IN ('unreplied', 'ai_suggested', 'draft', 'pending_approval', 'approved', 'published')),
    external_reply_comment TEXT,
    external_reply_update_time TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Compound foreign key constraints ensuring location and client belong to exact same agency
    CONSTRAINT fk_reviews_location FOREIGN KEY (location_id, agency_id)
        REFERENCES locations(id, agency_id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_client FOREIGN KEY (client_id, agency_id)
        REFERENCES clients(id, agency_id) ON DELETE CASCADE,
    -- Prevent duplicate review ingestion for the same location
    CONSTRAINT uq_reviews_location_google_review UNIQUE (location_id, google_review_id),
    -- Composite unique anchor for downstream child tables (review_replies)
    CONSTRAINT uq_reviews_id_agency UNIQUE (id, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_agency_id ON reviews(agency_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_agency ON reviews(client_id, agency_id);
CREATE INDEX IF NOT EXISTS idx_reviews_location_agency ON reviews(location_id, agency_id);
CREATE INDEX IF NOT EXISTS idx_reviews_star_rating ON reviews(agency_id, star_rating);
CREATE INDEX IF NOT EXISTS idx_reviews_reply_status ON reviews(agency_id, reply_status);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_create_time ON reviews(agency_id, review_create_time DESC);

-- Enable PostgreSQL Row-Level Security for reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_reviews ON reviews;
CREATE POLICY tenant_isolation_reviews ON reviews
    FOR ALL
    USING (
        agency_id = NULLIF(current_setting('app.current_agency_id', true), '')::uuid
    );

-- -----------------------------------------------------------------------------
-- 2. REVIEW REPLIES TABLE (AI suggestions, human drafts, approval & publishing log)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    review_id UUID NOT NULL,
    location_id UUID NOT NULL,
    suggested_reply TEXT,
    ai_model VARCHAR(100),
    ai_tone VARCHAR(50),
    draft_reply TEXT,
    final_published_reply TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'suggested' 
        CHECK (status IN ('suggested', 'draft', 'pending_approval', 'approved', 'published', 'rejected')),
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    published_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    publish_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Compound foreign key constraints ensuring review and location belong to exact same agency
    CONSTRAINT fk_review_replies_review FOREIGN KEY (review_id, agency_id)
        REFERENCES reviews(id, agency_id) ON DELETE CASCADE,
    CONSTRAINT fk_review_replies_location FOREIGN KEY (location_id, agency_id)
        REFERENCES locations(id, agency_id) ON DELETE CASCADE,
    -- Exactly one active reply workflow record per customer review
    CONSTRAINT uq_review_replies_review UNIQUE (review_id),
    CONSTRAINT uq_review_replies_id_agency UNIQUE (id, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_review_replies_agency ON review_replies(agency_id);
CREATE INDEX IF NOT EXISTS idx_review_replies_review ON review_replies(review_id);
CREATE INDEX IF NOT EXISTS idx_review_replies_status ON review_replies(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_review_replies_location ON review_replies(location_id, agency_id);

-- Enable PostgreSQL Row-Level Security for review_replies
ALTER TABLE review_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_review_replies ON review_replies;
CREATE POLICY tenant_isolation_review_replies ON review_replies
    FOR ALL
    USING (
        agency_id = NULLIF(current_setting('app.current_agency_id', true), '')::uuid
    );
