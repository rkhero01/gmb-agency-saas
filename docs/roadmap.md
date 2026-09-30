# Project Roadmap & Implementation Phases

This document defines the structured development roadmap for GMB Agency SaaS.

---

## Phase 0: Initial Foundation (Current Phase)
- [x] Repository initialization & folder structure (`frontend`, `backend`, `database`, `workers`, `docs`).
- [x] Backend Express REST API skeleton with environment configuration.
- [x] Health check endpoint (`GET /api/v1/health`) with JSON diagnostics.
- [x] Multi-tenant database schema definition and RLS strategy (`database/migrations`).
- [x] Tenant context middleware pattern to safeguard agency boundary.
- [x] React + Vite frontend dashboard shell with live health-check indicator.
- [x] Comprehensive documentation and verification scripts.

---

## Phase 1: Database Setup & Core Tenant Models
- [x] Connect PostgreSQL pool with health check and reconnect logic.
- [x] Implement migration runner (`migrator.js` with `schema_migrations` tracking).
- [x] Data access repositories: `AgencyRepository`, `UserRepository`, `ClientRepository`, `LocationRepository`.
- [x] Seed and verification test suite with tenant isolation.

---

## Phase 2: Authentication & Team RBAC
- [x] User registration, agency creation, and invite flow.
- [x] Secure JWT authentication with HMAC-SHA256 signature and bcrypt password hashing.
- [x] Role-based access control (5 roles: `owner`, `admin`, `manager`, `specialist`, `viewer`).
- [x] Final active owner protection, role escalation prevention & viewer read-only guard.

---

## Phase 3: Client & Location Management CRUD
- [x] Client CRUD endpoints and frontend views (client list, create, edit, archive, delete).
- [x] Location CRUD with address validation, business details, timezone, and phone fields.
- [x] Compound foreign key `(client_id, agency_id)` tenant boundary enforcement.

---

## Phase 4: Google Cloud OAuth 2.0 & GBP API Integration
- [x] Google Cloud Console project setup & verified OAuth 2.0 authorization-code flow.
- [x] Secure token storage in `google_oauth_accounts` with Row-Level Security isolation.
- [x] Zero token exposure: access tokens and refresh tokens strictly omitted from frontend/logs.
- [x] Google Business Profile account discovery and location linking (`Agency -> Client -> Location -> GBP`).
- [x] Safe disconnect lifecycle with database token nullification.

---

## Phase 5: Review Management & AI Replies
- [ ] Synchronize Google customer reviews to local database.
- [ ] Unified review inbox with filters (star rating, replied status, location).
- [ ] Manual review replies posted back to Google API.
- [ ] AI-assisted reply generator (OpenAI / Claude / Gemini API integration).

---

## Phase 6: Post Scheduling & Media Asset Manager
- [ ] Google Post composer (Updates, Offers, Events, CTAs).
- [ ] Asset upload pipeline (images with S3 or Cloudflare R2 storage).
- [ ] Background worker post scheduler (BullMQ / pg-boss cron runner).
- [ ] Recurring post templates.

---

## Phase 7: Analytics & Automated Client Reporting
- [ ] Ingest GBP Insights: Search queries, Maps vs. Search views, calls, directions, website clicks.
- [ ] Interactive charting on agency and location dashboards.
- [ ] Automated scheduled PDF reports sent to client emails.

---

## Phase 8: Billing, Subscriptions & White-Labeling
- [ ] Stripe integration for agency subscriptions (tiered by managed locations).
- [ ] Custom agency branding (custom logo, accent colors).
- [ ] Custom domain mapping (e.g. `portal.clientagency.com`) for white-label client logins.
