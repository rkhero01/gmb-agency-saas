# Multi-Tenancy Architecture & Isolation Strategy

## Overview

In an agency SaaS, the greatest risk is **accidental cross-agency data exposure**. An agency must never be able to view, edit, or leak another agency's clients, locations, reviews, or Google credentials.

This document details the multi-tenant architecture and enforcement mechanisms implemented in GMB Agency SaaS.

---

## Multi-Tenant Model

We utilize a **Shared Database with Discriminator Column (`agency_id`) + Row-Level Security (RLS)** strategy.

### Why this model?
1. **Cost & Operational Efficiency**: Agencies share database resources, minimizing maintenance overhead and infrastructure costs compared to separate databases per tenant.
2. **Strict Isolation**: By enforcing `agency_id` on every table and combining application-level scoping with database-level RLS, data leakage risks are mitigated at two independent layers.
3. **Seamless Aggregation**: Multi-tenant metrics and background workers can run efficient batch operations without needing hundreds of disparate database connection pools.

---

## Tenant Data Hierarchy & Constraints

All relational entities strictly reference `agency_id`:

```
agencies
  └── id (UUID, PK)

users
  ├── id (UUID, PK)
  ├── agency_id (UUID, FK -> agencies.id ON DELETE CASCADE)
  └── ...

clients
  ├── id (UUID, PK)
  ├── agency_id (UUID, FK -> agencies.id ON DELETE CASCADE)
  └── ...

locations
  ├── id (UUID, PK)
  ├── agency_id (UUID, FK -> agencies.id ON DELETE CASCADE)
  ├── client_id (UUID, FK -> clients.id ON DELETE CASCADE)
  └── ...

gmb_profiles
  ├── id (UUID, PK)
  ├── agency_id (UUID, FK -> agencies.id ON DELETE CASCADE)
  ├── location_id (UUID, FK -> locations.id ON DELETE CASCADE)
  └── ...
```

### Key Foreign Key & Compound Constraints
To prevent assigning a location belonging to Client A to a different agency:
- Tables include compound unique constraints: `UNIQUE(id, agency_id)`
- Foreign keys between child and parent tables enforce both parent ID and parent agency ID:
  ```sql
  FOREIGN KEY (client_id, agency_id) REFERENCES clients(id, agency_id)
  ```
  This guarantees that even if an attacker attempts an IDOR (Insecure Direct Object Reference) by sending a foreign `client_id`, the database constraint rejects the insert or update.

---

## Application-Level Tenant Isolation

### 1. Tenant Context Middleware (`tenantContext.js`)
When an HTTP request enters the backend:
1. Authentication validates the user's JWT.
2. The user's verified `agency_id` is extracted from the session/token.
3. A `tenantContext` object is attached to `req.tenant`:
   ```javascript
   req.tenant = {
     agencyId: verifiedUser.agency_id,
     userId: verifiedUser.id,
     role: verifiedUser.role
   };
   ```

### 2. Query Scoping Guard
Every database query function must require `agencyId` as an explicit parameter:
```javascript
// Good: Always strictly scoped
export async function getClientById(agencyId, clientId) {
  return db.query(
    'SELECT * FROM clients WHERE id = $1 AND agency_id = $2',
    [clientId, agencyId]
  );
}

// Prohibited: Unscoped access
export async function getClientByIdUnsafe(clientId) {
  // VIOLATION: Cross-tenant vulnerability!
  return db.query('SELECT * FROM clients WHERE id = $1', [clientId]);
}
```

---

## Database-Level Row-Level Security (RLS)

For maximum security in production, PostgreSQL Row-Level Security is enabled on multi-tenant tables:

```sql
-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Set policy based on session variable
CREATE POLICY agency_isolation_policy ON clients
  FOR ALL
  USING (agency_id = NULLIF(current_setting('app.current_agency_id', true), '')::uuid);
```

When database connections are retrieved from the pool, the application sets `app.current_agency_id` inside the transaction:
```sql
SET LOCAL app.current_agency_id = 'c0a80101-0000-0000-0000-000000000001';
```

Even if developer code accidentally forgets an `agency_id` filter in a raw query, the PostgreSQL engine automatically strips rows belonging to other agencies.

---

## Audit & Prevention Checklist

- [x] Every multi-tenant table has an indexed `agency_id` column.
- [x] Compound foreign keys enforce that parent-child relationships share the same `agency_id`.
- [x] Controllers never trust client-supplied tenant identifiers in request bodies.
- [x] Background workers explicitly pass tenant context into each queued job payload.
