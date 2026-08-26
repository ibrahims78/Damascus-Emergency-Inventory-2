#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [openapi, routes, settings, syncPage] = await Promise.all([
  readFile(new URL("../lib/api-spec/openapi.yaml", import.meta.url), "utf8"),
  readFile(new URL("../artifacts/api-server/src/routes/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../artifacts/web/src/pages/settings.tsx", import.meta.url), "utf8"),
  readFile(new URL("../artifacts/web/src/pages/sync.tsx", import.meta.url), "utf8"),
]);

for (const path of [
  "/backups",
  "/backups/inspect",
  "/backups/dry-run",
  "/backups/restore",
  "/backups/{restorePointId}/rollback",
  "/sync/node",
  "/sync/sessions",
  "/sync/pairings",
  "/sync/trusted-nodes",
  "/sync/conflicts",
  "/sync/relay/packages",
]) {
  assert.ok(openapi.includes(`  ${path}:`), `OpenAPI path missing: ${path}`);
}
assert.match(routes, /router\.use\("\/backups", backupsRouter\)/);
assert.match(routes, /router\.use\("\/sync", syncRouter\)/);
assert.match(settings, /\/api\/backups\/(inspect|dry-run|restore)/);
assert.match(syncPage, /\/pairings|\/relay\/packages|\/conflicts/);
console.log("PASS phase 12 OpenAPI exposes backup, restore, sync, relay, and conflict contracts");
console.log("PASS phase 12 API mounts and admin UI flows are wired to the documented contracts");