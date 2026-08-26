# نظام مستودع الإسعاف والطوارئ — دمشق

تطبيق ويب داخلي لإدارة مستودع منظومة الاحالة و الاسعاف و الطوارئ - دمشق، يتيح إدخال وإخراج المواد والتجهيزات، وإصدار سندات مطبوعة، ولوحة تحكم مع مؤشرات وتنبيهات، وتقارير متقدمة مع دعم كامل للعربية RTL.

## Run & Operate

- API server runs on port 8080 via workflow `artifacts/api-server: API Server`
- Web frontend runs on port 22333 via workflow `artifacts/web: web`
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run phase8:acceptance` — API acceptance smoke test while API workflow is running
- `pnpm run build:android:offline` — build the Android offline APK with the local IndexedDB offline API
- `DATABASE_URL` is provisioned automatically by Replit (runtime-managed)
- `SESSION_SECRET` is set as a Replit Secret

## Default credentials

- Username: `admin` / Password: `Admin@1234` (admin role — change after first login)

## Stack

- pnpm workspaces, Node.js 20+, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/web/src/pages/` — all frontend pages (users.tsx, settings.tsx, transactions.tsx, reports.tsx, etc.)
- `artifacts/web/src/components/layout/` — sidebar, header (with alerts bell), layout shell
- `artifacts/api-server/src/routes/` — Express route handlers (one file per domain)
- `artifacts/api-server/src/middlewares/audit.ts` — `auditLog()` helper for writing to audit_log table
- `lib/db/src/schema/` — Drizzle table definitions (source of truth for DB structure)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (do NOT edit directly)
- `scripts/import-excel.mjs` — Excel import script (reads عهدة المستودع .xlsx and seeds items + init transactions)

## Architecture decisions

- **OpenAPI-first**: all API hooks are generated from `lib/api-spec/openapi.yaml` via Orval. After any spec change, run `pnpm --filter @workspace/api-spec run codegen` then `tsc --build`.
- **Settings page** uses direct `fetch()` + TanStack Query `useQuery`/`useMutation` since settings hooks weren't in the last codegen run.
- **Audit log** (`audit_log` table) is append-only. The `auditLog()` helper in `src/middlewares/audit.ts` fails silently — add it to routes without wrapping in try/catch.
- **Excel import**: the عهدة file uses row 0 as sheet title, row 1 as real column headers. The import script skips equipment sheets (column name: "الجهاز", not in the item name candidates list).

## Product

تطبيق ويب داخلي RTL كامل لإدارة مستودع الإسعاف بدمشق. الصفحات المكتملة:
- **لوحة التحكم** — إحصائيات + مخططات حركة المواد
- **المواد / التجهيزات** — CRUD كامل مع بحث وفلتر
- **العمليات** — تسجيل إدخال وإخراج + سند A4 قابل للطباعة (RTL)
- **التقارير** — 7 تبويبات (جرد، حركة، انتهاء صلاحية، أقل من الحد، تجهيزات، الوضع التفصيلي، العهد المفتوحة) + طباعة وتصدير Excel
- **المستخدمون** — CRUD كامل (admin فقط) مع أدوار ثلاثة
- **الإعدادات** — ملف شخصي، تغيير كلمة المرور، إعدادات المنظومة
- **التنبيهات** — جرس في الـ Header مع SSE وحالات قراءة/حل
- **التوثيق** — `docs/operations.md` للتشغيل والنسخ الاحتياطي، و`docs/user-guide-ar.md` لدليل المستخدم

## Android offline release

- The Android application is a Capacitor wrapper around the web frontend.
- Android release builds set `VITE_OFFLINE_MODE=1`, which replaces `/api/*` calls with the local IndexedDB-backed implementation in `artifacts/web/src/lib/offline-api.ts`.
- The APK does not require the Replit API, PostgreSQL, or an external server. Data stays on the device and can be exported from the application backup screen.
- Release artifacts and checksums are stored under the matching version directory in `releases/android/`.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- بعد أي تعديل على `lib/api-spec/openapi.yaml`، يجب تشغيل `pnpm --filter @workspace/api-spec run codegen` ثم `tsc --build` قبل typecheck.
- `pnpm --filter @workspace/web run typecheck` يفشل إذا لم تُبنَ مكتبات الـ TypeScript أولاً — شغّل `tsc --build` من الجذر أولاً.
- ملف Excel عهدة المستودع هو قالب فارغ (لا يحتوي بيانات حقيقية حتى الآن).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
