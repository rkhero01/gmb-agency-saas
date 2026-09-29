# Database Architecture & Migrations

This directory contains the database migration scripts and schema definitions for the GMB Agency SaaS platform.

## Production Database: PostgreSQL

The application is designed for PostgreSQL 14+ using a **Shared Database with Discriminator Column (`agency_id`) + Row-Level Security (RLS)** architecture.

---

## Directory Structure

```
database/
├── README.md                  # This guide
└── migrations/
    └── 001_initial_schema.sql # Core multi-tenant hierarchy tables & RLS policies
```

---

## Schema Hierarchy

The relational schema implements the core SaaS hierarchy:

```
agencies
  ├── users             (Agency staff)
  └── clients           (Agency client brands)
        └── locations   (Physical locations / service branches)
              └── gmb_profiles (Linked Google Business Profile listings)
```

---

## Applying Migrations

### Local PostgreSQL Setup

1. Create a local database:
```bash
createdb gmb_agency_saas_dev
```

2. Run the foundational migration:
```bash
psql -d gmb_agency_saas_dev -f database/migrations/001_initial_schema.sql
```

3. Update your `.env` or `backend/.env` with your database credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gmb_agency_saas_dev
DB_USER=postgres
DB_PASSWORD=your_password
```

---

## Multi-Tenant Security Highlights in Schema

1. **Foreign Key Guarantees**:
   Every child table has a compound foreign key referencing both the parent entity and `agency_id`, ensuring a child location or profile cannot accidentally belong to an entity from a different agency.

2. **UUID Primary Keys**:
   UUIDv4 prevents sequential enumeration attacks across tenants.

3. **Row-Level Security (RLS)**:
   Policies are defined to restrict data access based on PostgreSQL session variables:
   ```sql
   current_setting('app.current_agency_id', true)::uuid
   ```
