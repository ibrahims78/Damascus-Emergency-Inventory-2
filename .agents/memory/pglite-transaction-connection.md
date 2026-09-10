---
name: PGlite transaction connection boundary
description: Avoid mixing the global database handle with an active local PGlite transaction.
---

## Rule

Resolve reads that use the global database handle before opening a PGlite transaction, or perform them through the transaction executor itself.

**Why:** PGlite uses a serialized local connection; a global query started from inside an active transaction can wait indefinitely and make API requests fail only after the client's fetch timeout.

**How to apply:** When a service starts a transaction and needs node or installation identity, load that identity before `db.transaction(...)` and pass it into the transaction-scoped operation.