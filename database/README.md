# Database Architecture & Migrations

This directory contains the database migration scripts and schema definitions for the GMB Agency SaaS platform.

## Production Database: PostgreSQL

The application uses PostgreSQL 14+ with a **Shared Database with Discriminator Column (`agency_id`) + Row-Level Security (RLS)** architecture.

---

## Directory Structure

```
database/
├── README.md                          # This guide
└── migrations/
    ├── 001_core_schema.sql            # Core multi-tenant hierarchy tables & constraints
    └── 002_row_level_security.sql     # Row-Level Security (RLS) policies
```

---

## Schema Hierarchy

The relational schema implements the core SaaS hierarchy:

```
agencies (Tenant Root)
  ├── users                    (Agency staff: owner, admin, manager, specialist, viewer)
  └── clients                  (Agency client brands)
        └── locations          (Physical branches / service areas)
              └── google_business_profiles (Foundational GBP listings linkage)
```

---

## Running Migrations

The platform includes an automated migration runner in `backend/src/database/migrator.js` that tracks applied migrations in the `schema_migrations` table inside transactions.

### Running Migrations via npm

```bash
# Apply all pending migrations
npm run db:migrate

# Inspect migration status
npm run db:status
```

---

## Local PostgreSQL Setup

### Option 1: Native PostgreSQL (macOS, Linux, Windows)

1. Ensure PostgreSQL is installed and service is running:
```bash
# Test connectivity
pg_isready -h localhost -p 5432
```

2. Create the development database:
```bash
createdb gmb_agency_saas_dev
```

3. Configure your `backend/.env` file:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gmb_agency_saas_dev
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_SSL=false
```

4. Run the migration script:
```bash
npm run db:migrate
```

### Option 2: Automated Testing Engine (In-Memory PostgreSQL)

For automated test runners, CI pipelines, or local development environments without an active PostgreSQL daemon, the test runner automatically utilizes `pg-mem` to execute the exact migration files and run the full 8-point tenant isolation test suite:

```bash
npm run test:tenant
```

---

## Multi-Tenant Security Highlights in Schema

1. **Foreign Key Guarantees**:
   Every child table has a compound foreign key referencing both the parent entity and `agency_id`:
   ```sql
   CONSTRAINT fk_locations_client FOREIGN KEY (client_id, agency_id)
       REFERENCES clients(id, agency_id) ON DELETE CASCADE
   ```
   This ensures a child location cannot accidentally or maliciously reference a client belonging to a different agency.

2. **UUID Primary Keys**:
   UUIDv4 generated via `gen_random_uuid()` prevents sequential enumeration attacks across tenants.

3. **Row-Level Security (RLS)**:
   Policies restrict data access based on PostgreSQL session variables:
   ```sql
   agency_id = NULLIF(current_setting('app.current_agency_id', true), '')::uuid
   ```
