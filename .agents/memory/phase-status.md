---
name: Phase completion status
description: Tracks which implementation phases are done and which remain
---

## Current development plan — Phases 0–14 complete in development ✅
## Phase 15 — Pilot execution and owner sign-off pending ⏳
## August 2026 Review — 10-gap remediation ✅ Complete

## Second Code Audit — 7 additional bugs fixed ✅ (August 2026)

1. **Negative stock allowed in POST /api/items** — added `currentStock >= 0` and `minStock >= 0` validation
2. **Duplicate username returns 500** — Drizzle wraps pg errors under `err.cause.code`; fixed to check `err?.cause?.code === '23505'`
3. **OUT transaction allowed without recipient/exitReason** — backend now requires both for all OUT transactions
4. **item-form.tsx missing onError toast** — createMutation and updateMutation now show error toast on failure
5. **equipment-form.tsx missing onError toast** — both mutations now show Arabic error toast on failure
6. **audit.tsx CSV export breaks on commas** — fields now wrapped in quotes with double-quote escaping
7. **users.tsx admin can demote own role** — role selector disabled when editing own account; explanatory note shown

## First Code Audit — 7 bugs fixed (August 2026, same session)

1. backup.ts 500 error — usersTable.active → usersTable.isActive
2. XLSX exports named .csv — all 5 filenames changed to .xlsx
3. Missing await on exportXlsx — added await to all 5 calls
4. Duplicate ملاحظات column header in EquipmentTab
5. Hardcoded expiry days in reports.ts — reads expiryAlertDays from settings
6. Hardcoded expiry days in items.ts — reads expiryAlertDays from settings
7. setupCompleted not set after admin creation — auth.ts now sets it

## Seed data
`artifacts/api-server/seed.mjs` seeds: 4 categories, admin user, 8 recipients, 8 exit reasons.
Run with: `cd artifacts/api-server && node seed.mjs`

## Resolved items (no longer pending)
- Print voucher now reads orgName from systemSettingsTable ✅
- Transactions list now has debounced text search (documentNumber, itemName, equipmentName, recipientName) ✅
- Logo (@assets alias) now points to artifacts/web/src/assets/logo.jpeg ✅
- Sidebar is collapsible (SidebarProvider context + localStorage) ✅
- Designer signature (إبراهيم الصيداوي · 0933706403) in sidebar footer ✅
- App version v1.0.0 in sidebar footer ✅

## Professional Alerts System — Complete ✅ (August 2026)

Full overhaul of the alerts bell:
- `alerts` + `alert_reads` DB tables (already existed, confirmed)
- `startAlertWorker()` wired into `app.ts` — runs every 2h + on boot
- OpenAPI spec updated: Alert schema expanded (dbId, entityId, entityType, entityName, isRead, createdAt, updatedAt); 5 new endpoints added (read-all, refresh, :id/read, :id/resolve, stream)
- Codegen re-run — all new hooks generated (useMarkAllAlertsRead, useMarkAlertRead, useResolveAlert, useRefreshAlerts)
- Header rewritten: SSE replaces polling, unread badge (not total), severity sections (critical/warning), per-alert read+resolve buttons, mark-all-read, direct entity navigation
- UserRole uses `warehouse_manager` not `accountant` (OpenAPI schema source of truth)

## Phase 7 (Reports, print, audit, permissions) — Complete ✅
- Added reconciled stock-position and open/overdue custody report tabs and OpenAPI contracts.
- Expanded transaction printing for custody, return, damage, central return, and adjustment movements.
- Normalized category write permissions to admin and expanded CRUD audit coverage.

## Phase 8 (Acceptance and operations verification) — Complete ✅
- `phase8:acceptance` covers health, unauthenticated reports, viewer login, report contracts, custody filtering, and category RBAC.
- Full typecheck/build and phase 1–6 smoke suite pass; API and web workflows run.

## Phase 9 (Migration and release) — Documentation complete; release gate pending ⏳
- Added `docs/operations.md`, `docs/user-guide-ar.md`, and `CHANGELOG.md`.
- GitHub push requires an authenticated GitHub/Replit integration or an equivalent secure `GITHUB_TOKEN`.
- Production release still requires operational approval of balance rules and environment data.

## Current verification — August 18, 2026
- Re-ran typecheck, builds, phases 1–14 smoke tests, and API `/api/healthz`; all passed in development PostgreSQL.
- Phase 15 remains an operational gate because it requires real Windows/Android/Web nodes and data-owner Go/No-Go approval.

## Key architectural notes
- ProtectedRoute: useEffect BEFORE early returns (Rules of Hooks)
- equipment-form.tsx uses useToast (shadcn) — rest of app uses sonner toast
- transaction-out-form.tsx also uses useToast — inconsistency but both work
- Drizzle wraps pg unique-constraint errors under err.cause.code (not err.code)
