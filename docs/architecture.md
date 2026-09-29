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
│   ├── Tenant Resolution Middleware (agency_id context) │
│   ├── Authentication & RBAC Guard                      │
│   └── REST Controllers & Service Layer                 │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────┐   ┌─────────────────────────┐
│     Persistence Tier     │   │      Worker Tier        │
│   PostgreSQL Database    │   │ Async Background Engine │
│  - Multi-tenant schemas  │   │  - Google Sync Worker   │
│  - RLS Policies          │   │  - Post Scheduler       │
│  - JSONB attributes      │   │  - Review Alert Cron    │
└──────────────────────────┘   └─────────────────────────┘
```

---

## Domain Hierarchy

```
Agency (Tenant Root)
│
├── Users (Staff: Owner, Admin, Manager, Specialist)
│
└── Clients (Agency Customers)
    │
    └── Locations (Physical addresses / store branches)
        │
        └── Google Business Profiles (Linked Google account entity)
            ├── Reviews & Responses
            ├── Scheduled Posts & Media
            └── Performance Insights (Views, Calls, Clicks)
```

### Entity Responsibilities

1. **Agency**:
   - The top-level account/tenant. Owns all users, client records, locations, and integrations.
   - Holds billing plan, settings, and white-label branding configurations.

2. **User**:
   - Represents agency personnel. Belongs to exactly one agency.
   - Has a role determining system permissions (e.g. `OWNER`, `ADMIN`, `MANAGER`, `VIEWER`).

3. **Client**:
   - Represents a business client of the agency (e.g. "Apex Dental Group").
   - Can have multiple physical locations.

4. **Location**:
   - Represents a physical branch or service territory (e.g. "Apex Dental - Downtown").
   - Stores address, contact numbers, categories, and business hours.

5. **Google Business Profile (GBP Profile)**:
   - Contains the external Google account reference (`account_id`, `location_id`, `resource_name`).
   - Stores OAuth token references (securely encrypted), sync status, verification state, and cached metrics.

---

## API Architecture Principles

1. **Stateless REST**:
   All state is stored in the database. Every request carries the required context (Authentication token and resolved tenant identifier).

2. **Layered Separation of Concerns**:
   - **Routes**: Define URL paths and map to controllers with attached middleware.
   - **Middleware**: Intercepts requests for authentication, tenant resolution, request validation, and logging.
   - **Controllers**: Handle HTTP semantics (parsing input, invoking services, returning standard response formats).
   - **Services**: Pure business logic agnostic of HTTP transport.
   - **Repositories / Models**: Encapsulate database queries and ensure strict tenant scoping.

3. **Standardized Response Envelope**:
   ```json
   {
     "success": true,
     "data": { ... },
     "meta": { ... }
   }
   ```
   Or for errors:
   ```json
   {
     "success": false,
     "error": {
       "code": "RESOURCE_NOT_FOUND",
       "message": "The requested resource was not found."
     }
   }
   ```
