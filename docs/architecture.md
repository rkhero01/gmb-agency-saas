# System Architecture

## Overview

The GMB Agency SaaS is a multi-tenant platform designed for digital marketing agencies to manage Google Business Profiles across hundreds of client locations.

```
┌────────────────────────────────────────────────────────┐
│                       Client Tier                      │
│        React SPA (Vite) - Agency Admin Portal          │
│   ├── Authentication & Session State                   │
│   ├── Agency Overview & KPI Dashboards                 │
│   └── Team Management & RBAC View                      │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS / JSON REST
                           ▼
┌────────────────────────────────────────────────────────┐
│                     API Gateway Tier                   │
│         Node.js + Express REST API Server              │
│   ├── Security Middleware (Helmet, CORS)               │
│   ├── Authenticate Middleware (JWT Cryptographic Claim)│
│   ├── Centralized RBAC Middleware (Permissions Matrix) │
│   ├── Team & Tenant Service Layer                      │
│   └── Repositories & Error Handlers                    │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────┐   ┌─────────────────────────┐
│     Persistence Tier     │   │      Worker Tier        │
│   PostgreSQL 18 Database │   │ Async Background Engine │
│  - Multi-tenant schemas  │   │  (Reserved Phase 4+)    │
│  - Compound FK bounds    │   │                         │
│  - RLS Policies          │   │                         │
└──────────────────────────┘   └─────────────────────────┘
```

---

## Domain Hierarchy & Relational Model

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

---

## Authentication & Team RBAC Subsystem (Phase 2)

### 1. Authentication Flow
1. **User Authentication**: Client sends `POST /api/v1/auth/login` with `{ email, password }`.
2. **Password Verification**: Validated against salted bcrypt hash (`bcryptjs` with 10 salt rounds).
3. **Brute-Force Guard**: 5 consecutive failed login attempts automatically trigger a 15-minute account lock.
4. **Token Generation**: Generates HMAC-SHA256 JWT containing `{ userId, agencyId, role }`.
5. **Zero-Trust Tenant Derivation**: `req.tenant` is populated strictly from the verified JWT claims, never from client-controlled headers.

### 2. Team RBAC & Role Hierarchy

| Role | Weight | Permissions | Escalation Boundaries |
| :--- | :--- | :--- | :--- |
| **`owner`** | 100 | All permissions (team, agency, clients, locations, GBP) | Can assign/modify all roles; can transfer ownership. |
| **`admin`** | 80 | `team:invite`, `team:update_role`, `team:deactivate`, `client:*`, `location:*`, `gbp:*` | Cannot assign `owner`; cannot demote/modify/deactivate an `owner`. |
| **`manager`** | 60 | `client:view`, `client:update`, `location:*`, `gbp:*`, `team:view` | Operational account management; cannot manage team users. |
| **`specialist`** | 40 | `location:view`, `location:update`, `gbp:*`, `team:view` | GBP posting and review workflow; cannot modify clients or team. |
| **`viewer`** | 20 | `*:view` | Read-only access; non-GET requests return `403 VIEWER_READ_ONLY`. |

### 3. Governance Safeguards
- **Unauthorized Role Escalation Prevention**: An actor cannot assign or alter a role equal to or higher than their own level.
- **Final Active Owner Protection**: The system prevents demoting or deactivating the last active owner in an agency, guaranteeing that an agency account is never orphaned.

---

## API Endpoints (Phase 0, 1 & 2)

### Core System
- `GET /api/v1/health` — Returns system diagnostics, uptime, and database connectivity.

### Authentication
- `POST /api/v1/auth/login` — Authenticates user, returns JWT and user profile.
- `POST /api/v1/auth/register` — Provisions a new agency with initial owner user.
- `POST /api/v1/auth/logout` — Terminates authenticated session.
- `GET /api/v1/auth/me` — Protected route returning current user and agency context.

### Team Governance
- `GET /api/v1/team` — Lists all team members within the caller's tenant agency.
- `POST /api/v1/team/invite` — Invites/creates a new team member with assigned role.
- `PATCH /api/v1/team/:userId/role` — Updates member role with escalation and final owner guards.
- `PATCH /api/v1/team/:userId/status` — Deactivates or reactivates team members with final owner guard.
