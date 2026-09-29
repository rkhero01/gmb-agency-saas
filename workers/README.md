# Background Workers & Automation Subsystem

## Overview

This directory is reserved for the asynchronous background processing tier of GMB Agency SaaS.

Per Phase 0 specifications:
- No background workers or mock queues are executed in this initial foundation phase.
- Production architecture is documented below to guide implementation in future phases (Phase 4+).

---

## Planned Architecture

In later phases, long-running and scheduled jobs will be processed out-of-band to prevent blocking the HTTP REST API:

1. **Job Queue Engine**:
   - **BullMQ** (backed by Redis) or **pg-boss** (backed by PostgreSQL).
   - Redis or PostgreSQL will handle job persistence, delayed retries, and concurrency limits.

2. **Planned Worker Jobs**:
   - `google-profile-sync`: Background sync of location details, metadata, and verification states from Google Business Profile API.
   - `review-ingestion`: Scheduled polling for newly posted customer reviews.
   - `post-scheduler`: Precision timed publishing of scheduled Google Business Profile posts (updates, offers, events).
   - `metrics-aggregator`: Nightly aggregation of GBP search impressions, phone call clicks, and driving direction requests.
   - `report-generator`: Compiling monthly agency and client performance PDFs.

3. **Multi-Tenant Context Preservation**:
   Every dispatched job must include `{ agencyId, ... }` in its payload. Worker processors must initialize their execution context with that `agencyId` to maintain strict tenant data isolation.
