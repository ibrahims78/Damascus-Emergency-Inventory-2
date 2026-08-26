---
name: Demo movement fixtures
description: Durable rules for seeded inventory movement data and its verification.
---

Use a stable marker and scenario-specific lookup for persistent demo movements so
rerunning the seed resumes the fixture instead of duplicating stock changes.
Verify exact movement counts, batch allocations, final balances, and custody states;
presence-only checks can miss arithmetic drift.

**Why:** The fixture is intentionally visible in the application and may be seeded
again after a restart or workspace refresh. Duplicate positive movements would
silently corrupt the demonstration balances.

**How to apply:** Keep every scenario deterministic and uniquely named, make the
seed safe to rerun, and assert the expected ledger result after all scenarios.

When using the `postgres` tagged SQL client, build composite note strings before
interpolating them; adjacent template interpolations are emitted as adjacent
PostgreSQL parameters and can produce invalid SQL. FEFO assertions must reflect
the actual scenario order and should verify the exact allocation rows.

**Why:** The persistent Excel/demo seed exposed both risks during a fresh
workspace bootstrap: the database remained partially seeded after an SQL error,
and an allocation expectation that did not match its declared movement order
could falsely report a valid fixture as broken.

**How to apply:** Keep one interpolated variable per composite text value, then
rerun the idempotent seed after any failed attempt and compare both ledger counts
and allocation details.