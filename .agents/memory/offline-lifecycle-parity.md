---
name: Offline lifecycle parity
description: Consistency rule for offline inventory movements with related lifecycle entities
---

Offline movement emulation must mirror the server's atomic side effects, not only append a transaction. Custody delivery and return require their related custody records, status/quantity updates, and sync change-log entries.

**Why:** A custody delivery in the Android offline path was recorded as a movement but had no personal custody row, so it appeared successful yet was absent from the custody report and could not be returned.

**How to apply:** When adding or changing a server movement type, audit the offline route for every related table/entity, balance update, response shape, and idempotent sync record.