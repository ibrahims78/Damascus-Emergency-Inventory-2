---
name: Backup restore user references
description: Cross-environment backups must account for different local user IDs because users are intentionally not restored.
---

When restoring a backup between environments, preserve the current environment's users and remap missing `created_by` or `user_id` references to the authenticated administrator before inserting dependent records.

**Why:** Backup packages omit password hashes and therefore do not restore users; production user IDs can differ from the source environment, causing full restores to fail on foreign-key references such as audit logs.

**How to apply:** Resolve existing production user IDs inside the restore transaction, pass the current admin as a fallback, and keep the remapping visible in the restore result or audit trail.

Explicit-ID restores must also resynchronize every affected serial sequence, including `audit_log`, before accepting new writes.

**Why:** Imported rows can have IDs far ahead of the local sequence; the next audit insert then collides with an existing primary key even though the restore itself appears successful.

**How to apply:** Run sequence synchronization inside the same restore transaction after inserts, and repair existing environments by setting each sequence to its table's current maximum ID.