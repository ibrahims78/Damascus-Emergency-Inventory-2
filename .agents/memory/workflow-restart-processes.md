---
name: Workflow restart behavior
description: Replit artifact workflow restarts may leave an orphaned child server process.
---

Managed artifact workflows own their commands and environment; use the artifact
metadata validation flow to change ports or env, not `configureWorkflow`.
When an artifact workflow fails during restart with `EADDRINUSE`, check for and
stop the previous child server process before restarting the managed workflow.

**Why:** Replacing a managed workflow bypasses artifact routing and is rejected;
failed managed restarts can also leave the old server process listening while
the workflow wrapper exits.

**How to apply:** Edit and validate the artifact TOML for service settings,
restart the exact managed workflow, and if it fails with `EADDRINUSE`, confirm
the listener and terminate only the stale process for that artifact.