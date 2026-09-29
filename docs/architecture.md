# System Architecture

## Overview

The GMB Agency SaaS is a multi-tenant platform designed for digital marketing agencies to manage Google Business Profiles across hundreds of client locations.

```
┌────────────────────────────────────────────────────────┐
│                       Client Tier                      │
│        React SPA (Vite) - Agency Admin Portal          │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS / JSON REST
                           ▼
┌────────────────────────────────────────────────────────┐
│                     API Gateway Tier                   │
│         Node.js + Express REST API Server              │
│   ├── Security Middleware (Helmet, CORS, Rate Limit)   │
│   ├── Tenant Resolution Middleware (Session-Derived)   │
│   ├── Service & Repository Layer                       │
│   └── REST Controllers & Error Handlers                │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────┐   ┌─────────────────────────┐
│     Persistence Tier     │   │      Worker Tier        │
│   PostgreSQL Database    │   │ Async Background Engine │
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

### Table Definitions & Roles

#### 1. `agencies` (Tenant Root)
- `id` (UUID PK, default `gen_random_uuid()`)
- `name` (VARCHAR(255) NOT NULL)
- `slug` (VARCHAR(100) NOT NULL UNIQUE)
- `status` (VARCHAR(50) NOT NULL DEFAULT 'active')
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### 2. `users` (Agency Team Members)
- `id` (UUID PK)
- `agency_id` (UUID FK -> `agencies.id` ON DELETE CASCADE)
- `name` (VARCHAR(255) NOT NULL)
- `email` (VARCHAR(255) NOT NULL)
- `password_hash` (VARCHAR(255) NOT NULL - hashed with bcrypt, no plaintext stored)
- `role` (VARCHAR(50) NOT NULL - `owner`, `admin`, `manager`, `specialist`, `viewer`)
- `status` (VARCHAR(50) NOT NULL DEFAULT 'active')
- `created_at`, `updated_at` (TIMESTAMPTZ)
- Constraints: `UNIQUE (agency_id, email)` (email unique within agency), `UNIQUE (id, agency_id)`

#### 3. `clients` (Agency Customers / Brands)
- `id` (UUID PK)
- `agency_id` (UUID FK -> `agencies.id` ON DELETE CASCADE)
- `name` (VARCHAR(255) NOT NULL)
- `business_name` (VARCHAR(255))
- `email` (VARCHAR(255))
- `phone` (VARCHAR(50))
- `website` (VARCHAR(255))
- `status` (VARCHAR(50) NOT NULL DEFAULT 'active')
- `created_at`, `updated_at` (TIMESTAMPTZ)
- Constraints: `UNIQUE (id, agency_id)`

#### 4. `locations` (Store Branches / Service Areas)
- `id` (UUID PK)
- `agency_id` (UUID FK -> `agencies.id` ON DELETE CASCADE)
- `client_id` (UUID NOT NULL)
- `name` (VARCHAR(255) NOT NULL)
- `address_line1`, `address_line2` (VARCHAR(255))
- `city`, `state`, `postal_code`, `country`, `timezone`
- `phone`, `website`
- `status` (VARCHAR(50) NOT NULL DEFAULT 'active')
- `created_at`, `updated_at` (TIMESTAMPTZ)
- **Integrity Constraint**: `FOREIGN KEY (client_id, agency_id) REFERENCES clients(id, agency_id) ON DELETE CASCADE`
  *(Guarantees a location cannot reference a client belonging to a different agency)*

#### 5. `google_business_profiles` (Foundational Entity)
- `id` (UUID PK)
- `agency_id` (UUID FK -> `agencies.id` ON DELETE CASCADE)
- `client_id` (UUID NOT NULL)
- `location_id` (UUID NOT NULL)
- `google_account_id` (VARCHAR(255))
- `google_location_id` (VARCHAR(255))
- `profile_name` (VARCHAR(255))
- `status` (VARCHAR(50) NOT NULL DEFAULT 'active')
- `connection_status` (VARCHAR(50) NOT NULL DEFAULT 'disconnected')
- `created_at`, `updated_at` (TIMESTAMPTZ)
- Constraints: `FOREIGN KEY (location_id, agency_id) REFERENCES locations(id, agency_id) ON DELETE CASCADE`

---

## Service & Repository Pattern

Database access is decoupled from HTTP transport:

```
[Controllers / Middleware]
       │
       ▼
[Services]  (e.g., TenantService)
       │
       ▼
[Repositories]
 ├── AgencyRepository
 ├── UserRepository (Password hashing, role enforcement)
 ├── ClientRepository (Strict agency_id scoping)
 ├── LocationRepository (Strict agency_id scoping)
 └── GoogleBusinessProfileRepository
       │
       ▼
[PostgreSQL Database (pg.Pool / Transaction Clients)]
```

Every repository method requires an explicit `agencyId` argument and enforces scoping on every read and write query.
