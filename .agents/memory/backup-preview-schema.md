---
name: Backup preview schema recovery
description: Restore previews must work against older hosted databases that lack the backup preview migration.
---

The restore-preview path should create its small preview table and expiry index idempotently before reading or writing preview tokens.

**Why:** Older installations can have a valid core schema while missing the backup-preview migration, causing a successful dry run to fail before restore confirmation.

**How to apply:** Keep this guard in the shared server restore service; desktop schema initialization remains necessary for PGlite databases.