---
name: Replit deployment CORS
description: Published Replit web apps use replit.app origins that must be allowed by the API CORS policy
---

The API CORS allowlist must support both Replit preview domains (`replit.dev`) and published domains (`replit.app`), in addition to local development origins.

**Why:** The published frontend sends its login request with a `replit.app` Origin; allowing only `replit.dev` causes the API to return 500 before authentication runs.

**How to apply:** When changing deployment domains or CORS, test an authenticated API route with the exact published Origin header and confirm `Access-Control-Allow-Origin` plus credentials support.