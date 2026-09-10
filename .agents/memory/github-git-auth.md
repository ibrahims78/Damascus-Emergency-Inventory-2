---
name: GitHub Git authentication
description: GitHub HTTPS push authentication behavior when using a Replit secret
---

Use a GitHub token from the Replit secret environment through a temporary Basic authentication helper using the `x-access-token` username; do not put the token in the remote URL or print it.

**Why:** The token can be valid for the GitHub API and have push permission while Git HTTPS authentication with a Bearer extra header is rejected as invalid credentials.

**How to apply:** Keep the remote URL token-free and configure the local credential helper to read `GITHUB_TOKEN` only at push time. Verify with `git push --dry-run` before making changes.