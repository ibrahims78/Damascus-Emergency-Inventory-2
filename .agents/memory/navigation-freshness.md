---
name: Navigation freshness
description: UX rules for route transitions and query freshness in the warehouse web app
---

Every authenticated route transition must reset the shell's internal scroll container to the top, and the shared query client should refetch stale data when the browser window regains focus.

**Why:** The app scrolls inside a nested main element rather than the document, so browser-default scroll restoration does not reliably start each new interface at its first section; warehouse data can also change while the app is backgrounded.

**How to apply:** Keep the route-aware scroll reset in the shared shell and preserve explicit mutation invalidations plus realtime/polling freshness for alerts and dashboards.