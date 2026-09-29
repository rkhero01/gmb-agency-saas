# GMB Agency SaaS

A production-ready, multi-tenant Software-as-a-Service (SaaS) platform architected specifically for digital marketing agencies to centrally manage, monitor, and optimize multiple **Google Business Profiles** across their entire client portfolio.

---

## Table of Contents

- [Project Purpose](#project-purpose)
- [Multi-Tenant Hierarchy](#multi-tenant-hierarchy)
- [System Architecture](#system-architecture)
- [Folder Structure](#folder-structure)
- [Technology Decisions](#technology-decisions)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
  - [1. Install Dependencies](#1-install-dependencies)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. PostgreSQL Database Setup & Migrations](#3-postgresql-database-setup--migrations)
  - [4. Run Verification & Tenant Isolation Tests](#4-run-verification--tenant-isolation-tests)
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
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JSON REST
                           ▼
┌────────────────────────────────────────────────────────┐
│                  Node.js Express API                   │
│   ├── Security Middleware (Helmet, CORS)               │
│   ├── Tenant Context Middleware (Session-Derived)      │
│   ├── Service & Repository Layer                       │
│   │   ├── AgencyRepository, UserRepository             │
│   │   ├── ClientRepository, LocationRepository         │
│   │   └── GoogleBusinessProfileRepository              │
│   └── REST Controllers & Error Handlers                │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                  │
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
│       │   ├── layout/       # App shell: Sidebar, Topbar, Layout
│       │   ├── ui/           # Reusable metric cards, badges
│       │   └── dashboard/    # Overview analytics, tenant health widget, hierarchy preview
│       ├── services/         # Centralized API client (Fetch abstraction)
│       ├── App.jsx           # Root application component
│       ├── main.jsx          # DOM entry point
│       └── index.css         # Modern design system & CSS custom properties
│
├── backend/                  # Node.js Express REST API
│   ├── .env.example          # Backend-specific environment variables
│   ├── package.json          # Backend dependencies & scripts
│   └── src/
│       ├── config/           # Validated environment configuration & DB pool
│       ├── controllers/      # Route controllers (Health, Agency, etc.)
│       ├── database/         # Migration runner & tenant session context
│       │   ├── migrator.js   # Automated migration executor & tracker
│       │   └── session.js    # withTenantContext transaction helper (RLS)
│       ├── middleware/       # Tenant isolation, error handler, not-found
│       ├── repositories/     # Data access layer strictly scoped by agency_id
│       │   ├── agency.repository.js
│       │   ├── user.repository.js (Bcrypt password hashing)
│       │   ├── client.repository.js
│       │   ├── location.repository.js
│       │   └── googleBusinessProfile.repository.js
│       ├── routes/           # REST endpoints mapping (/api/v1/health)
│       ├── services/         # Business logic layer (TenantService)
│       ├── tests/            # Test suite (tenant isolation & migrator checks)
│       │   ├── tenant-isolation.test.js
│       │   └── migrator.test.js
│       ├── app.js            # Express application configuration & security
│       └── server.js         # HTTP server listener & graceful shutdown
│
├── database/                 # Database Schema & Migrations
│   ├── README.md             # Migration workflow & setup docs
│   └── migrations/
│       ├── 001_core_schema.sql         # Agencies, Users, Clients, Locations, GBP
│       └── 002_row_level_security.sql  # Row-Level Security policies
│
├── workers/                  # Background Jobs & Automation (Phase 4+)
│   └── README.md             # Planned architecture for async sync workers
│
└── docs/                     # Architectural & Technical Specifications
    ├── architecture.md       # High-level architecture and domain model
    ├── multi-tenancy.md      # Multi-tenant security & tenant context rules
    └── roadmap.md            # Phased implementation plan (Phase 0 to Phase 8)
```

---

## Technology Decisions

1. **Frontend (React + Vite + Vanilla CSS)**
   - **Vite**: Ultra-fast build times, hot module replacement (HMR), lightweight footprint.
   - **React with clean JavaScript**: Agility, zero configuration bloat.
   - **Modern Vanilla CSS**: Leverages CSS variables (custom properties), CSS grid/flexbox, glassmorphic accents, and responsive layout.

2. **Backend (Node.js + Express REST API)**
   - **Express**: Battle-tested, lightweight REST framework.
   - **Layered Architecture**: Routes -> Controllers -> Services -> Repositories -> PostgreSQL.
   - **Zero-Trust Tenant Security**: Tenant identity derived exclusively from authenticated user sessions (no raw header trust in production).
   - **Password Security**: Bcrypt with salted rounds (`bcryptjs`). Plaintext passwords are never stored.

3. **Database (PostgreSQL 14+)**
   - **Multi-Tenant Strategy**: Shared database with discriminator column (`agency_id`) + compound foreign keys.
   - **Compound Foreign Key Bounds**: `FOREIGN KEY (client_id, agency_id) REFERENCES clients(id, agency_id)` guarantees at the engine level that child locations cannot be associated with foreign agency clients.
   - **Row-Level Security (RLS)**: Enforced via PostgreSQL policies conditioned on `app.current_agency_id`.

---

## Prerequisites

- **Node.js**: v18.0.0 or higher (Tested on Node v24 LTS)
- **npm**: v9.0.0 or higher
- **PostgreSQL**: v14+ (For live database execution; test runner includes automated fallback engine)

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

### 3. PostgreSQL Database Setup & Migrations

For local PostgreSQL:
```bash
# 1. Create development database
createdb gmb_agency_saas_dev

# 2. Run automated migrations
npm run db:migrate

# 3. Check migration status
npm run db:status
```

### 4. Run Verification & Tenant Isolation Tests

The project includes an automated test suite verifying tenant isolation and relational constraints:

```bash
# Run all tests (tenant isolation + migration runner)
npm test

# Run tenant isolation test suite specifically
npm run test:tenant
```

The test verifies:
1. Agency A creation.
2. Client A creation under Agency A.
3. Location A creation under Client A.
4. Agency B creation.
5. Client B creation under Agency B.
6. Agency A cannot access Client B.
7. Agency B cannot access Client A.
8. Location cannot reference a client belonging to another agency (proves compound FK constraint).

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
- **Phase 2**: Authentication & Team RBAC *(Next)*
- **Phase 3**: Client & Location Management CRUD
- **Phase 4**: Google Cloud OAuth 2.0 & GBP API Integration
- **Phase 5**: Review Management & AI Replies
- **Phase 6**: Post Scheduling & Media Library
- **Phase 7**: Analytics & Automated Client Reporting
- **Phase 8**: Billing, Subscriptions & White-Labeling
