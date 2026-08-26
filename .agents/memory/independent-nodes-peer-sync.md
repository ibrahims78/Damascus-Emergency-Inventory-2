---
name: Independent nodes and peer sync
description: Durable product decision for standalone databases, peer-to-peer synchronization, and separate backup/restore flows
---

Each Windows, Android, and web installation must remain an independent database that can operate offline. Synchronization is an on-demand, bidirectional exchange of durable changes between any two nodes; no installation is permanently the sole source of truth.

**Why:** The user explicitly requires separate operation for every installation and simple synchronization only when needed, including Windows↔Android, Windows↔web, and Android↔web.

**How to apply:** Build around a per-installation node identity, global record IDs, idempotent operation IDs, append-only change history, tombstones, conflict review, and a common encrypted transfer format. Keep full backup/restore separate from delta synchronization, with preview and a pre-restore checkpoint.