import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { db, syncConflictTable, syncChangeLogTable } from "../lib/db/src/index.ts";
import { classifyConflictSeverity } from "../artifacts/api-server/src/lib/sync-service.ts";
import { listSyncConflicts, resolveSyncConflict } from "../artifacts/api-server/src/lib/conflict-service.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for phase nine conflict smoke");

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const suffix = randomUUID();
let conflictId = 0;
let changeId = "";

try {
  assert.equal(classifyConflictSeverity("BALANCE_NEGATIVE"), "critical");
  assert.equal(classifyConflictSeverity("DOCUMENT_NUMBER_COLLISION"), "high");
  assert.equal(classifyConflictSeverity("OPERATION_PAYLOAD_MISMATCH"), "medium");
  console.log("PASS phase 9 conflict severity policy classifies inventory risk");

  changeId = `phase9-change-${suffix}`;
  await db.insert(syncChangeLogTable).values({
    changeId,
    operationId: `phase9-operation-${suffix}`,
    entityType: "items",
    entityGlobalId: randomUUID(),
    changeType: "update",
    payload: { source: "phase9-smoke" },
    originNodeId: `phase9-node-${suffix}`,
    originSequence: 1,
    status: "conflict",
  });
  const [conflict] = await db.insert(syncConflictTable).values({
    changeId,
    conflictCode: "BALANCE_NEGATIVE",
    severity: "critical",
    details: { source: "phase9-smoke" },
  }).returning();
  conflictId = conflict.id;
  const open = await listSyncConflicts("open");
  assert.ok(open.some((row) => row.conflict.id === conflictId));
  const resolved = await resolveSyncConflict({
    conflictId,
    userId: 1,
    resolution: "defer",
  });
  assert.equal(resolved.status, "deferred");
  const deferred = await listSyncConflicts("deferred");
  assert.ok(deferred.some((row) => row.conflict.id === conflictId));
  console.log("PASS phase 9 conflict queue records a user decision and supports defer");
} finally {
  if (conflictId) await sql`DELETE FROM sync_conflicts WHERE id = ${conflictId}`;
  if (changeId) await sql`DELETE FROM sync_change_log WHERE change_id = ${changeId}`;
  await sql.end({ timeout: 2 });
}