---
name: Git bootstrap in a populated Replit workspace
description: A reliable way to attach an initially empty workspace to an existing remote without deleting Replit-managed hidden files.
---

When a workspace already contains Replit-managed hidden files, attach the remote from inside the workspace with `git init`, fetch the intended branch, and set the local branch to track it instead of cloning into `.`.

**Why:** Cloning into a non-empty workspace can fail or tempt destructive cleanup of platform files; direct initialization preserves the environment and keeps the remote history intact.

**How to apply:** Verify the remote, branch, and commit parity after fetching before making feature changes; use HTTPS Git credentials only when a push requires them.