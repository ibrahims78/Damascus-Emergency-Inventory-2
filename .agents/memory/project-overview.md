---
name: Project overview & run commands
description: Stack, entry points, credentials, and key run commands for the Damascus EMS warehouse system
---

## Stack
- pnpm workspaces, Node.js 20, TypeScript 5.9
- API: Express 5, port 8080 (`artifacts/api-server`)
- Frontend: React + Vite, port 22333, BASE_PATH=/ (`artifacts/web`)
- DB: PostgreSQL + Drizzle ORM (DATABASE_URL auto-provisioned)
- Auth: session-based with SESSION_SECRET (Replit Secret)
- API codegen: Orval from `lib/api-spec/openapi.yaml`

## First-run
- App shows setup screen (`/setup`) to create admin account on fresh DB
- Default after seed: admin / Admin@1234

## Key commands
- `pnpm install` — install all deps
- `pnpm --filter @workspace/db run push` — push schema to DB
- `tsc --build` — build all TS libs (required before web typecheck)
- `pnpm run typecheck` — full typecheck (must run tsc --build first)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate hooks after OpenAPI spec changes

## Generated hooks
Never edit `lib/api-client-react/src/generated/api.ts` directly.
To use `refetchInterval`, spread `getXxxQueryOptions()` into `useQuery` directly rather than passing via the hook's `query` option (TypeScript strictness issue with UseQueryOptions).

**Why:** The generated hooks' `UseQueryOptions` type requires `queryKey` which makes inline option overrides error-prone.

**How to apply:** `const { data } = useQuery({ ...getListAlertsQueryOptions(), refetchInterval: 5 * 60 * 1000 });`
