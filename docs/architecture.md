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

---

## Client & Location Management (Phase 3)

### Relational Hierarchy
```
Agency -> Client -> Location -> Google Business Profile
```

### Endpoints
- `GET /api/v1/clients` — Lists client brand portfolios for the agency.
- `POST /api/v1/clients` — Creates a new client brand.
- `GET /api/v1/clients/:clientId` — Retrieves client details.
- `PATCH /api/v1/clients/:clientId` — Updates client details.
- `DELETE /api/v1/clients/:clientId` — Cascading delete of client and child locations.
- `GET /api/v1/clients/:clientId/locations` — Lists locations under a specific client.
- `POST /api/v1/clients/:clientId/locations` — Creates a location strictly bound to `(client_id, agency_id)`.
- `GET /api/v1/locations/:locationId` — Retrieves location details.
- `PATCH /api/v1/locations/:locationId` — Updates location address and details.
- `DELETE /api/v1/locations/:locationId` — Deletes location and cascades linked GBP profiles.

---

## Google Cloud OAuth 2.0 & GBP Integration (Phase 4)

### 1. OAuth 2.0 Authorization Code Flow
```
User (Browser)            Backend API                       Google Cloud OAuth
      │                        │                                    │
      │── Connect Request ────>│                                    │
      │   GET /google/connect  │── Create signed state JWT ────────>│
      │<── Auth URL & State ───│   (agencyId, userId, nonce)        │
      │                        │                                    │
      │── Redirect to Google ──────────────────────────────────────>│
      │   (Consent Screen)     │                                    │
      │<── Auth Code & State ───────────────────────────────────────│
      │                        │                                    │
      │── Callback with Code ─>│                                    │
      │   GET /google/callback │── Verify State JWT signature       │
      │                        │── Server-to-server Token Exchange ─>│
      │                        │<── Access & Refresh Tokens ────────│
      │                        │── Store tokens in DB (RLS isolated)│
      │<── Redirect Dashboard ─│                                    │
```

### 2. Google Cloud Setup & Configuration

#### Required Google APIs
1. **Google Business Profile API** (`mybusiness.googleapis.com`)
2. **My Business Business Information API** (`mybusinessbusinessinformation.googleapis.com`)
3. **My Business Account Management API** (`mybusinessaccountmanagement.googleapis.com`)
4. **Google OAuth 2.0 API** (`oauth2.googleapis.com`)

#### Minimum Required Scopes
- `openid`: OpenID authentication.
- `https://www.googleapis.com/auth/userinfo.email`: Read connected Google account email.
- `https://www.googleapis.com/auth/userinfo.profile`: Read account holder name and profile image.
- `https://www.googleapis.com/auth/business.manage`: Read and manage Google Business listings.

#### Environment Variables
```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/v1/google/callback
```

#### Production Redirect URI Requirements
- Must use HTTPS in production environments.
- Must match the Authorized Redirect URI registered in the Google Cloud Console Credentials page exactly.
- For local development: `http://localhost:5000/api/v1/google/callback`.

### 3. Security Considerations & Zero Token Leakage
1. **Server-Side Token Exchange**: The OAuth code exchange occurs exclusively on the backend. The Google Client Secret is never sent to or embedded within the frontend.
2. **Cryptographic Anti-CSRF State**: State tokens are HMAC-SHA256 signed JWTs with 15-minute expirations embedding `agencyId`, `userId`, and a cryptographically random `nonce`.
3. **Zero Token Exposure**: Access tokens and refresh tokens are strictly masked in all repository and controller responses. Token strings never appear in frontend state or API outputs.
4. **PostgreSQL RLS Tenant Isolation**: The `google_oauth_accounts` table is protected by PostgreSQL Row-Level Security (`tenant_isolation_google_oauth_accounts`) preventing cross-tenant access.
5. **Cascading Relational Cleanup**: Deleting an internal Location automatically deletes the corresponding `google_business_profiles` link via foreign key constraints. Disconnecting clears stored tokens and marks status as `disconnected`.

### 4. Google Endpoints
- `GET /api/v1/google/connect` — Generates authorization URL with signed state.
- `GET /api/v1/google/callback` — Handles OAuth redirect and exchanges code for tokens.
- `GET /api/v1/google/status` — Checks sanitized connection status (zero tokens returned).
- `GET /api/v1/google/accounts` — Fetches accessible Google Business accounts.
- `GET /api/v1/google/locations` — Fetches accessible Google Business locations.
- `GET /api/v1/google/profiles` — Lists all linked GBP locations for the agency.
- `POST /api/v1/google/locations/:locationId/link` — Links internal location to GBP location.
- `DELETE /api/v1/google/locations/:locationId/link` — Unlinks internal location from GBP.
- `POST /api/v1/google/disconnect` — Safely revokes and nullifies stored agency credentials.
