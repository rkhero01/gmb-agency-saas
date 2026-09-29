# Multi-Tenancy Architecture & Security Specifications

## 1. Overview

In an agency SaaS, the highest-priority architectural requirement is **absolute tenant isolation**. An agency managing dozens of client brands and physical locations must never be able to access, modify, or leak data belonging to another agency.

This document details the multi-tenant architecture, data model constraints, and security enforcement mechanisms implemented in GMB Agency SaaS.

---

## 2. Multi-Tenant Relational Model

We enforce multi-tenancy at two distinct levels:
1. **Application / Repository Level**: Every query requires an explicit `agency_id` filter.
2. **Database Level**: Compound foreign keys and PostgreSQL Row-Level Security (RLS) enforce isolation inside the database engine itself.

### Entity Relationship & Isolation Tree

```
agencies (id, name, slug, status)
  │
  ├── users (id, agency_id, email, password_hash, role, status)
  │     └── CONSTRAINT uq_agency_user_email UNIQUE (agency_id, email)
  │     └── CONSTRAINT uq_users_id_agency UNIQUE (id, agency_id)
  │
  └── clients (id, agency_id, name, business_name, email, phone, website, status)
        │ └── CONSTRAINT uq_clients_id_agency UNIQUE (id, agency_id)
        │
        └── locations (id, agency_id, client_id, name, address..., status)
              │ └── CONSTRAINT fk_locations_client FOREIGN KEY (client_id, agency_id)
              │         REFERENCES clients(id, agency_id) ON DELETE CASCADE
              │ └── CONSTRAINT uq_locations_id_agency UNIQUE (id, agency_id)
              │
              └── google_business_profiles (id, agency_id, client_id, location_id..., status)
                    └── CONSTRAINT fk_gbp_location FOREIGN KEY (location_id, agency_id)
                            REFERENCES locations(id, agency_id) ON DELETE CASCADE
```

---

## 3. Database-Level Cross-Tenant Reference Prevention

A common multi-tenant vulnerability occurs when an attacker in Agency A sends an ID belonging to a client in Agency B when creating a location:
```
POST /api/v1/locations
Body: { "clientId": "<Agency_B_Client_UUID>", "name": "Unauthorized Location" }
```

In GMB Agency SaaS, the database schema **structurally rejects** this request via compound foreign keys:

```sql
CONSTRAINT fk_locations_client FOREIGN KEY (client_id, agency_id)
    REFERENCES clients(id, agency_id) ON DELETE CASCADE;
```

Because `clients` enforces `UNIQUE(id, agency_id)`, PostgreSQL verifies that both `client_id` AND `agency_id` exist together in the parent table. If Agency A attempts to reference a client belonging to Agency B, PostgreSQL raises a foreign key violation:
```
insert or update on table "locations" violates foreign key constraint "fk_locations_client"
```

---

## 4. Tenant Context & Session Derivation (Zero-Trust Header Invariant)

### CRITICAL PRODUCTION RULE:
**A raw client-supplied `x-agency-id` header MUST NEVER be treated as a trusted authentication mechanism in production.**

### Intended Security Model:
1. **Authentication**: Users submit credentials to `/api/v1/auth/login`.
2. **Verification**: The server verifies the password hash, issues a signed JWT containing `{ userId, agencyId, role }` or creates a server-side session.
3. **Session Resolution**: Authentication middleware cryptographically validates the token and populates `req.user = { id, agency_id, role }`.
4. **Tenant Context Attachment**: `req.tenant` is derived *exclusively* from `req.user.agency_id`.
5. **Development Override Safeguard**: A client-supplied `x-agency-id` header is accepted **only** in development or automated testing (`NODE_ENV !== 'production'`) to facilitate isolated testing before Phase 2 authentication is complete.

---

## 5. PostgreSQL Row-Level Security (RLS)

In addition to application query filters, PostgreSQL Row-Level Security provides defense-in-depth:

```sql
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_business_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_clients ON clients
    FOR ALL
    USING (agency_id = NULLIF(current_setting('app.current_agency_id', true), '')::uuid);
```

When database connections execute via [`withTenantContext`](file:///c:/Users/Admin/Downloads/gmb-agency-saas/backend/src/database/session.js):
```javascript
await client.query('SELECT set_config($1, $2, true)', ['app.current_agency_id', agencyId]);
```
The session parameter is local to that transaction (`is_local = true`), guaranteeing that queries within the transaction cannot access any row with a mismatched `agency_id`.

---

## 6. User Roles & Permissions

Users belong to an agency and have one of five strictly validated roles:

| Role | Hierarchy Level | Capabilities |
| :--- | :--- | :--- |
| **`owner`** | 1 | Full agency control, billing, team management, workspace settings |
| **`admin`** | 2 | Client creation, location management, team user invites |
| **`manager`** | 3 | Managing assigned clients & locations, publishing posts, replying to reviews |
| **`specialist`** | 4 | Drafting posts, preparing review responses, analyzing reports |
| **`viewer`** | 5 | Read-only access to client and location metrics |

---

## 7. Verification Testing

The system includes automated tenant-isolation verification in [`backend/src/tests/tenant-isolation.test.js`](file:///c:/Users/Admin/Downloads/gmb-agency-saas/backend/src/tests/tenant-isolation.test.js):

1. Creates Agency A.
2. Creates Client A under Agency A.
3. Creates Location A under Client A.
4. Creates Agency B.
5. Creates Client B under Agency B.
6. Verifies Agency A cannot access Client B.
7. Verifies Agency B cannot access Client A.
8. Verifies Location cannot reference a client belonging to another agency (FK violation).
