# Multi-Tenancy Architecture & Security Specifications

## 1. Overview

In an agency SaaS, the highest-priority architectural requirement is **absolute tenant isolation**. An agency managing dozens of client brands and physical locations must never be able to access, modify, or leak data belonging to another agency.

This document details the multi-tenant architecture, data model constraints, session resolution, and RBAC governance implemented in GMB Agency SaaS.

---

## 2. Multi-Tenant Relational Model

We enforce multi-tenancy at three complementary layers:
1. **Cryptographic Identity Layer**: Authenticated JWT sessions strictly bind users to their verified `agency_id`.
2. **Application / Repository Layer**: Every query requires an explicit `agency_id` filter and permission verification.
3. **Database Layer**: Compound foreign keys and PostgreSQL Row-Level Security (RLS) enforce isolation inside the database engine.

### Entity Relationship & Isolation Tree

```
agencies (id, name, slug, status)
  │
  ├── users (id, agency_id, email, password_hash, role, status, last_login_at, locked_until)
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

### CRITICAL PRODUCTION INVARIANT:
**A raw client-supplied `x-agency-id` header is NEVER treated as a trusted authentication mechanism in production.**

### Security Implementation:
1. **Authentication**: Users submit credentials to `/api/v1/auth/login`.
2. **Verification**: The server verifies the password hash, issues a signed JWT containing `{ userId, agencyId, role }`.
3. **Session Resolution**: Authentication middleware cryptographically validates the token and populates `req.user = { id, agency_id, role }`.
4. **Tenant Context Attachment**: `req.tenant` is derived *exclusively* from `req.user.agency_id`.
5. **Zero Trust on Headers**: If an attacker sends an `x-agency-id` header attempting to spoof a foreign agency ID, the authenticated middleware strictly ignores it and derives tenant context solely from the cryptographically verified JWT claims.

---

## 5. Team RBAC & Privilege Safeguards

### Role Hierarchy & Capabilities

| Role | Hierarchy Weight | Capabilities & Scope |
| :--- | :--- | :--- |
| **`owner`** | 100 | Full agency governance, billing, team management, ownership transfer |
| **`admin`** | 80 | Client & location CRUD, operational settings, team management up to admin |
| **`manager`** | 60 | Managing assigned clients & locations, operational data |
| **`specialist`** | 40 | Operational GBP work for assigned clients/locations |
| **`viewer`** | 20 | Read-only access across the tenant portfolio |

### Key Security Governance Rules:
1. **Role Escalation Prevention**: An actor cannot assign or alter a role equal to or higher than their own level. Specifically, admins cannot create, promote, or alter owners.
2. **Final Active Owner Protection**: An agency must always have at least one active owner. Demoting or deactivating the last active owner is rejected with `400 FINAL_OWNER_PROTECTION`.
3. **Viewer Read-Only Enforcement**: Users with the `viewer` role are restricted to idempotent `GET` and `HEAD` requests. Any state-modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`) return `403 VIEWER_READ_ONLY`.

---

## 6. PostgreSQL Row-Level Security (RLS)

PostgreSQL Row-Level Security provides defense-in-depth:

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
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
The session parameter is transaction-local (`is_local = true`), guaranteeing that queries within the transaction cannot access any row with a mismatched `agency_id`.
