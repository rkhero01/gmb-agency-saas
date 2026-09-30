# GMB Agency SaaS

A production-ready, multi-tenant Software-as-a-Service (SaaS) platform architected specifically for digital marketing agencies to centrally manage, monitor, and optimize multiple **Google Business Profiles** across their entire client portfolio.

---

## Table of Contents

- [Project Purpose](#project-purpose)
- [Multi-Tenant Hierarchy](#multi-tenant-hierarchy)
- [System Architecture](#system-architecture)
- [Folder Structure](#folder-structure)
- [Authentication & Team RBAC (Phase 2)](#authentication--team-rbac-phase-2)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
  - [1. Install Dependencies](#1-install-dependencies)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. PostgreSQL Setup & Migrations](#3-postgresql-setup--migrations)
  - [4. Run Comprehensive Verification Tests](#4-run-comprehensive-verification-tests)
  - [5. Start Backend API Server](#5-start-backend-api-server)
  - [6. Start Frontend Dashboard](#6-start-frontend-dashboard)
- [Planned Future Modules](#planned-future-modules)
- [Contributing & Code Standards](#contributing--code-standards)

---

## Project Purpose

Marketing agencies manage dozens to hundreds of local business listings on Google. Native tools lack multi-client aggregation, automated client reporting, cross-location review reply workflows, and centralized scheduled publishing.

**GMB Agency SaaS** provides:
- A multi-tenant agency portal where each agency has completely isolated workspaces.
- Seamless multi-client hierarchy: `Agency -> Users -> Clients -> Locations -> Google Business Profiles`.
- Cryptographic isolation, compound foreign keys, and PostgreSQL Row-Level Security to prevent any cross-agency data exposure.
- Robust role-based access control with 5 team roles and final owner protection.

---

## Multi-Tenant Hierarchy

```
Agency (Tenant Root)
│
├── Users (Staff: owner, admin, manager, specialist, viewer)
│
└── Clients (Agency Brand Portfolios)
    │
    └── Locations (Physical Storefronts & Service Territory Branches)
        │
        └── Google Business Profiles (Foundational Listing Linkage)
```

Every database query and API operation operates under a strictly resolved `agency_id` tenant context to guarantee that agencies can never access another agency's clients, locations, or operational data.

---

## System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   React + Vite SPA                     │
│        (Agency Dashboard, Modern Vanilla CSS)          │
│   ├── Authentication & Session State                   │
│   ├── Agency Overview & KPI Dashboards                 │
│   └── Team Management & RBAC View                      │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JSON REST
                           ▼
┌────────────────────────────────────────────────────────┐
│                  Node.js Express API                   │
│   ├── Security Middleware (Helmet, CORS)               │
│   ├── Authenticate Middleware (JWT Cryptographic Claim)│
│   ├── Centralized RBAC Middleware (Permissions Matrix) │
│   ├── Service & Repository Layer                       │
│   │   ├── AgencyRepository, UserRepository             │
│   │   ├── ClientRepository, LocationRepository         │
│   │   └── GoogleBusinessProfileRepository              │
│   └── REST Controllers & Error Handlers                │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   PostgreSQL 18 Database               │
│       - Shared Database with Discriminator Column      │
│       - Compound Foreign Keys (Integrity Bounds)       │
│       - Agency Scoping + Row-Level Security (RLS)      │
└────────────────────────────────────────────────────────┘
```

---

## Folder Structure

```
gmb-agency-saas/
├── .env.example              # Global environment variable reference
├── .gitignore                # Production git ignore definitions
├── package.json              # Monorepo-lite developer orchestrations
├── README.md                 # Complete system documentation
│
├── frontend/                 # React + Vite Client Application
│   ├── .env.example          # Frontend-specific environment variables
│   ├── package.json          # Frontend dependencies & scripts
│   ├── vite.config.js        # Vite build & development proxy configuration
│   ├── index.html            # Application entry HTML
│   └── src/
│       ├── components/
│       │   ├── auth/         # LoginView, registration, session management
│       │   ├── layout/       # App shell: Sidebar, Topbar, Layout
│       │   ├── team/         # TeamManagementView, member invites, role changes
│       │   ├── ui/           # Reusable metric cards, badges
│       │   └── dashboard/    # Overview analytics, tenant health widget, hierarchy preview
│       ├── services/         # Centralized API client with JWT storage & auth methods
│       ├── App.jsx           # Root application component with session & route protection
│       ├── main.jsx          # DOM entry point
│       └── index.css         # Modern design system & CSS custom properties
│
├── backend/                  # Node.js Express REST API
│   ├── .env.example          # Backend-specific environment variables
│   ├── package.json          # Backend dependencies & scripts
│   └── src/
│       ├── config/           # Validated environment configuration, DB pool, and permissions
│       │   ├── env.js
│       │   ├── database.js
│       │   └── permissions.js# Centralized RBAC permission matrix & escalation rules
│       ├── controllers/      # Route controllers (Auth, Team, Health)
│       ├── database/         # Migration runner & tenant session context
│       │   ├── migrator.js   # Automated migration executor & tracker
│       │   └── session.js    # withTenantContext transaction helper (RLS)
│       ├── middleware/       # JWT auth, RBAC authorizer, viewer safety, error handler
│       │   ├── auth.js
│       │   ├── tenantContext.js
│       │   ├── notFound.js
│       │   └── errorHandler.js
│       ├── repositories/     # Data access layer strictly scoped by agency_id
│       │   ├── agency.repository.js
│       │   ├── user.repository.js (Bcrypt password hashing & login counters)
│       │   ├── client.repository.js
│       │   ├── location.repository.js
│       │   ├── googleOAuth.repository.js
│       │   └── googleBusinessProfile.repository.js
│       ├── routes/           # REST endpoints mapping (/auth, /team, /clients, /locations, /google)
│       ├── services/         # Business logic layer (Auth, Team, Client, Location, Google)
│       │   └── google/       # Google OAuth 2.0 & Business Profile service
│       ├── tests/            # Test suite (isolation, RBAC, CRUD, Google OAuth)
│       │   ├── auth-rbac.test.js
│       │   ├── tenant-isolation.test.js
│       │   ├── client-location.test.js
│       │   ├── google-oauth-gbp.test.js
│       │   ├── migrator.test.js
│       │   └── index.js
│       ├── app.js            # Express application configuration & security
│       └── server.js         # HTTP server listener & graceful shutdown
│
├── database/                 # Database Schema & Migrations
│   ├── README.md             # Migration workflow & setup docs
│   └── migrations/
│       ├── 001_core_schema.sql         # Agencies, Users, Clients, Locations, GBP
│       ├── 002_row_level_security.sql  # Row-Level Security policies
│       ├── 003_auth_and_team_rbac.sql  # User login tracking & composite indexes
│       └── 004_google_oauth.sql        # Google OAuth credentials & multi-tenant isolation
│
├── workers/                  # Background Jobs & Automation (Phase 5+)
│   └── README.md             # Planned architecture for async sync workers
│
└── docs/                     # Architectural & Technical Specifications
    ├── architecture.md       # High-level architecture and domain model
    ├── multi-tenancy.md      # Multi-tenant security & tenant context rules
    └── roadmap.md            # Phased implementation plan (Phase 0 to Phase 8)
```

---

## Google Cloud OAuth 2.0 & GBP API Integration (Phase 4)

### 1. Google Cloud Project Setup
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a Google Cloud project (e.g. `gmb-agency-saas`).
3. Enable the following APIs in **APIs & Services > Library**:
   - **Google Business Profile API** (`mybusiness.googleapis.com`)
   - **My Business Business Information API** (`mybusinessbusinessinformation.googleapis.com`)
   - **My Business Account Management API** (`mybusinessaccountmanagement.googleapis.com`)
   - **Google OAuth 2.0 API** (`oauth2.googleapis.com`)
4. Configure the **OAuth Consent Screen** (User type: External, publish status: Testing).
5. Add test users (Google accounts) who will test authorizing business profiles.

### 2. Required OAuth Credentials
1. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
2. Application type: **Web application**.
3. **Authorized JavaScript origins**:
   - Local: `http://localhost:5173`
   - Production: `https://your-production-domain.com`
4. **Authorized redirect URIs**:
   - Local: `http://localhost:5000/api/v1/google/callback`
   - Production: `https://api.your-production-domain.com/api/v1/google/callback`
5. Copy the generated **Client ID** and **Client Secret**.

### 3. Required Minimum Scopes
To adhere to the principle of least privilege, only the minimum scopes required for GBP functionality are requested:
- `openid`: OpenID authentication.
- `https://www.googleapis.com/auth/userinfo.email`: Read connected Google account email.
- `https://www.googleapis.com/auth/userinfo.profile`: Read account holder name and avatar.
- `https://www.googleapis.com/auth/business.manage`: Manage Google Business listings, locations, and profiles.

### 4. Environment Variables
Add to your `backend/.env`:
```env
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/v1/google/callback
```
*(Never commit real Google credentials or client secrets to source control!)*

### 5. Security Invariants
- **Zero Token Leakage**: Access tokens and refresh tokens are strictly masked in all repository responses and API outputs. They are NEVER sent to the frontend or logged in plaintext.
- **Server-Side Token Exchange**: The frontend never handles authorization codes or client secrets.
- **HMAC-SHA256 Anti-CSRF State**: Every OAuth flow generates a cryptographically signed state token embedding `{ agencyId, userId, nonce }` verified on callback.
- **Multi-Tenant Token Isolation**: Stored in `google_oauth_accounts` protected by PostgreSQL Row-Level Security (`agency_id = current_setting('app.current_agency_id')`).
- **Domain Hierarchy Association**: Google Business locations are strictly linked down the hierarchy:
  `Agency -> Client -> Location -> Google Business Profile`. Cross-agency linking is mathematically prevented.

---

## Prerequisites

- **Node.js**: v18.0.0 or higher (Tested on Node v24 LTS)
- **npm**: v9.0.0 or higher
- **PostgreSQL**: v14+ (Tested on PostgreSQL 18.6)

---

## Local Setup

### 1. Install Dependencies

```bash
# Install root, backend, and frontend dependencies
npm run install:all
```

### 2. Environment Configuration

Copy the example environment files:

```bash
# Backend configuration
copy backend\.env.example backend\.env

# Frontend configuration
copy frontend\.env.example frontend\.env
```

Ensure your `backend/.env` has your PostgreSQL connection settings and Google OAuth credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gmb_agency_saas
DB_USER=postgres
DB_PASSWORD=your_postgres_password
JWT_SECRET=your_secure_jwt_secret_key_minimum_32_characters

# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/v1/google/callback
```

### 3. PostgreSQL Setup & Migrations

```bash
# Apply all database migrations (001, 002, 003, 004)
npm run db:migrate

# Inspect migration status
npm run db:status
```

### 4. Run Comprehensive Verification Tests

```bash
# Run all tests (tenant isolation, auth & team RBAC, client/location CRUD, Google OAuth & GBP)
npm test
```

### 5. Start Backend API Server

```bash
npm run dev:backend
```
The API server starts on `http://localhost:5000`. Health check is available at `GET /api/v1/health`.

### 6. Start Frontend Dashboard

```bash
npm run dev:frontend
```
The Vite dashboard starts on `http://localhost:5173`.

---

## Planned Future Modules

- **Phase 0**: Project Foundation *(Completed)*
- **Phase 1**: Database Setup & Core Tenant Models *(Completed)*
- **Phase 2**: Authentication & Team RBAC *(Completed)*
- **Phase 3**: Client & Location Management CRUD *(Completed)*
- **Phase 4**: Google Cloud OAuth 2.0 & GBP API Integration *(Completed)*
- **Phase 5**: Review Management & AI Replies *(Next)*
- **Phase 6**: Post Scheduling & Media Library
- **Phase 7**: Analytics & Automated Client Reporting
- **Phase 8**: Billing, Subscriptions & White-Labeling
