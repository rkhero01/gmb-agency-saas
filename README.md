# GMB Agency SaaS

A production-ready, multi-tenant Software-as-a-Service (SaaS) platform architected specifically for digital marketing agencies to centrally manage, monitor, and optimize multiple **Google Business Profiles** (formerly Google My Business) across their entire client portfolio.

---

## Table of Contents

- [Project Purpose](#project-purpose)
- [Multi-Tenant Hierarchy](#multi-tenant-hierarchy)
- [System Architecture](#system-architecture)
- [Folder Structure](#folder-structure)
- [Technology Decisions](#technology-decisions)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
  - [1. Clone and Install Dependencies](#1-clone-and-install-dependencies)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Start the Backend API](#3-start-the-backend-api)
  - [4. Start the Frontend Application](#4-start-the-frontend-application)
- [Health Check Verification](#health-check-verification)
- [Planned Future Modules](#planned-future-modules)
- [Contributing & Code Standards](#contributing--code-standards)

---

## Project Purpose

Marketing agencies juggle dozens to hundreds of local business listings on Google. Native tools lack multi-client agency aggregation, automated client reporting, cross-location review reply workflows, and centralized scheduled publishing.

**GMB Agency SaaS** solves this by providing:
- A multi-tenant agency portal where each agency has isolated workspaces.
- Seamless multi-client hierarchy: `Agency -> Users -> Clients -> Locations -> Google Business Profiles`.
- Future automated review triage, post scheduling, client performance reporting, and white-label client portals.

---

## Multi-Tenant Hierarchy

The system enforces strict tenant isolation at both the database and application levels:

```
Agency (Tenant Root)
│
├── Agency Users (Roles: Owner, Admin, Account Manager, Specialist)
│
└── Clients (Brands or companies managed by the agency)
    │
    └── Locations (Physical storefronts or service areas)
        │
        └── Google Business Profiles (Verified Google Business listing linkage)
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
│   ├── Tenant Context Middleware (Multi-Tenant Guard)   │
│   ├── Health Check & Core Routes                       │
│   └── Centralized Error Handling                       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                  │
│       - Shared Database with Discriminator Column      │
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
│       │   ├── ui/           # Reusable metric cards, badges, notifications
│       │   └── dashboard/    # Overview analytics, tenant health widget
│       ├── services/         # Centralized API client (Fetch/Axios abstraction)
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
│       ├── middleware/       # Tenant isolation, error handler, not-found
│       ├── routes/           # REST endpoints mapping (/api/v1/health)
│       ├── app.js            # Express application configuration & security
│       └── server.js         # HTTP server listener & graceful shutdown
│
├── database/                 # Database Schema & Migrations
│   ├── README.md             # Migration workflow & tenant isolation docs
│   └── migrations/
│       └── 001_initial_schema.sql  # Foundational DDL with RLS and constraints
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
   - **React with clean JavaScript**: Optimal balance of simplicity, agility, and minimal configuration overhead.
   - **Modern Vanilla CSS**: Leverages CSS variables (custom properties), CSS grid/flexbox, glassmorphic accents, and responsive layout without heavy dependencies or build-time locks.

2. **Backend (Node.js + Express REST API)**
   - **Express**: Battle-tested, un-opinionated, lightweight REST framework.
   - **Modular Layering**: Clear separation of concerns between HTTP routing, controllers, business services, and database queries.
   - **Tenant Context Middleware**: Extracts and verifies tenant context before executing business logic.

3. **Database (PostgreSQL)**
   - **Multi-Tenant Strategy**: Shared database with discriminator column (`agency_id`) indexed across all tenant-owned tables, coupled with PostgreSQL Row-Level Security (RLS) policies.
   - High performance, relational integrity, ACID compliance, and native JSONB support for storing rich Google Business Profile payload attributes in future phases.

---

## Prerequisites

- **Node.js**: v18.0.0 or higher (Tested on Node v24 LTS)
- **npm**: v9.0.0 or higher
- **PostgreSQL**: v14+ (Required for Phase 1+ migrations; Phase 0 runs health verification out-of-the-box)

---

## Local Setup

### 1. Clone and Install Dependencies

From the project root:

```bash
# Install backend and frontend dependencies
npm run install:all
```

Or install individually:

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Environment Configuration

Copy the example environment files:

```bash
# Backend configuration
cp backend/.env.example backend/.env

# Frontend configuration
cp frontend/.env.example frontend/.env
```

*(On Windows PowerShell, use `copy backend\.env.example backend\.env`)*

### 3. Start the Backend API

```bash
# From root directory:
npm run dev:backend

# Or from backend/ directory:
cd backend
npm run dev
```

The backend server will boot on `http://localhost:5000`.

### 4. Start the Frontend Application

```bash
# In a separate terminal, from root directory:
npm run dev:frontend

# Or from frontend/ directory:
cd frontend
npm run dev
```

The Vite dev server will start at `http://localhost:5173`.

---

## Health Check Verification

The backend exposes a standardized health check endpoint:

- **Endpoint**: `GET /api/v1/health`
- **Sample Response**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-09-29T15:00:00.000Z",
    "uptime": 12.34,
    "environment": "development",
    "version": "0.1.0"
  }
  ```

The frontend dashboard automatically connects to this endpoint and displays the live API status badge in the top navigation bar.

---

## Planned Future Modules

The platform is designed for phased rollout:

1. **Phase 1: Multi-Tenant Database & Core Domain Entities**
   - PostgreSQL schema migrations, repository patterns, agency & user registration.
2. **Phase 2: Authentication & Team Role-Based Access Control (RBAC)**
   - JWT authentication, password hashing, roles (Owner, Admin, Manager, Member).
3. **Phase 3: Client & Location Management CRUD**
   - Agency management of brand portfolios and individual physical locations.
4. **Phase 4: Google Cloud OAuth 2.0 & GBP API Integration**
   - Google Business Profile API linkage, account discovery, and location mapping.
5. **Phase 5: Review Aggregation & AI-Assisted Replies**
   - Ingestion of customer reviews, sentiment analysis, AI suggested response generator.
6. **Phase 6: Post Scheduling & Media Library**
   - Composing, previewing, and scheduling Google Posts (Updates, Offers, Events).
7. **Phase 7: Analytics & Automated Client Reporting**
   - Search views, call clicks, direction requests, automated PDF report generation.
8. **Phase 8: Billing, Subscriptions & White-Labeling**
   - Stripe subscription tiers, agency custom domains, and white-labeled client portals.

---

## Contributing & Code Standards

- **Strict Tenant Isolation**: All queries accessing multi-tenant resources must specify `agency_id`.
- **No Hardcoded Secrets**: Always load sensitive values via environment variables.
- **RESTful Conventions**: Standard HTTP methods and consistent status codes across all endpoints.
- **Clean Architecture**: Keep controllers thin, delegate domain logic to services, and encapsulate DB access.
