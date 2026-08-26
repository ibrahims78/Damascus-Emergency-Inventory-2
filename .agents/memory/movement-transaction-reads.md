---
name: Movement transaction reads
description: Prevents deadlocks and indefinite pending requests during inventory movement creation.
---

Reads performed while creating an inventory movement must use the active database transaction handle, not the module-level database connection.

**Why:** A separate connection can wait on locks held by the movement transaction, leaving the API request pending indefinitely and the UI stuck on “جاري الحفظ”.

**How to apply:** Pass the transaction object into helpers that resolve settings or reference data, and use its query/execute methods for every read that participates in the movement.