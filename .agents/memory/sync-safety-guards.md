---
name: Sync safety guards
description: Non-obvious correctness constraints for relay pairing and legacy baseline migration
---

Pairing consumption must claim the database row atomically under conditions that
exclude consumed, revoked, expired, or wrong-target codes; a read-then-write
check is vulnerable to concurrent double consumption.

**Why:** Pairing codes are single-use trust grants, so accepting the same code
twice would create an audit and trust ambiguity even if later sync operations
remain resumable.

**How to apply:** Keep the conditional update-and-return pattern when changing
pairing lifecycle code, and retain a concurrent-consumer smoke test.

Legacy baseline mappings must derive missing global IDs deterministically from
the entity type and legacy local ID, while still reporting duplicates and
sensitive fields without auto-applying data.

**Why:** Re-running a migration report must produce the same identity map so a
reviewed baseline can be reproduced and compared safely.

**How to apply:** Treat baseline generation as read-only and deterministic; any
automatic merge still requires an explicit reviewed migration step.