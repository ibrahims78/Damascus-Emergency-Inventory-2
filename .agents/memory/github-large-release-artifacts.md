---
name: GitHub large release artifacts
description: How this repository stores Windows release ZIPs larger than GitHub's regular file limit.
---

Windows Portable ZIPs can exceed GitHub's 100 MB regular-file limit. Track new oversized release ZIPs with Git LFS before committing and pushing; keep the checksum and README as normal Git files.

**Why:** GitHub rejects oversized regular blobs at pre-receive time, while LFS accepts the binary and preserves a downloadable repository artifact.

**How to apply:** Check `git lfs version`, add an appropriate release ZIP pattern with `git lfs track`, amend the commit so the index contains an LFS pointer, then push over the existing HTTPS credential helper.