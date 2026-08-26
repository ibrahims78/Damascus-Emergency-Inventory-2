---
name: Phase-one schema migrations
description: Safe additive migration pattern for the warehouse inventory foundation.
---

Phase-one schema changes must remain additive for the existing PostgreSQL database:
keep legacy summary columns and nullable transaction metadata, add new ledgers with
constraints, and review a targeted SQL migration instead of treating a generated
full-schema baseline as an upgrade.

**Why:** The project had an existing database but no migration history; an
unqualified Drizzle generate produced a full create-everything baseline that would
not be safe to run against an existing database.

**How to apply:** For future schema phases, update the Drizzle source schema,
apply development changes with `pnpm --filter @workspace/db run push`, and keep a
reviewed additive SQL migration plus rollback/backfill notes for staging and
publish review.