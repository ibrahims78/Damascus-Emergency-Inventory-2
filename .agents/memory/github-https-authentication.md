---
name: GitHub HTTPS authentication
description: Non-OAuth GitHub repository access behavior in this Replit environment.
---

For GitHub repository operations using a Personal Access Token, use HTTPS Basic authentication with username `x-access-token` and the token as the password. A Bearer `http.extraheader` can be accepted by the GitHub API but may fail or hang for Git transport.

**Why:** The GitHub API and Git transport do not always behave the same way for the same PAT; Basic auth successfully supports clone, fetch, and push dry-run verification.

**How to apply:** Keep `origin` token-free and use a dynamic credential helper that reads the Replit secret at operation time, or pass a Basic `Authorization` header for one-off Git commands. Never persist the token in `.git/config` or chat.