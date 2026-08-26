---
name: Protected release build boundaries
description: Durable build-separation and secret-scan rules for protected Windows/Android releases
---

Standard and protected builds must write to separate output directories, while secret scans should target strong signing-material signatures rather than generic words such as password.

**Why:** The API bundle legitimately contains authentication and database configuration terms; broad keyword scans report false positives and obscure real release-secret findings.

**How to apply:** Keep standard outputs in the existing runtime paths, place protected outputs under an isolated protected path, and scan tracked files plus protected artifacts for PEM/private-key and credential assignment patterns.