import { and, asc, eq } from "drizzle-orm";
import {
  db,
  syncChangeLogTable,
  syncConflictTable,
} from "@workspace/db";
import { ensureNodeIdentity, recordLocalChange } from "./sync-service";

export async function listSyncConflicts(status: "open" | "resolved" | "deferred" | "all" = "open") {
  const rows = await db
    .select({
      conflict: syncConflictTable,
      change: syncChangeLogTable,
    })
    .from(syncConflictTable)
    .leftJoin(syncChangeLogTable, eq(syncChangeLogTable.changeId, syncConflictTable.changeId))
    .where(status === "all" ? undefined : eq(syncConflictTable.status, status))
    .orderBy(asc(syncConflictTable.createdAt));
  return rows;
}

export async function resolveSyncConflict(input: {
  conflictId: number;
  userId: number;
  resolution: "approve" | "reject" | "correct" | "defer";
  correction?: Record<string, unknown>;
}) {
  if (input.resolution === "correct" && !input.correction) {
    throw new Error("SYNC_CORRECTION_REQUIRED");
  }
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ conflict: syncConflictTable, change: syncChangeLogTable })
      .from(syncConflictTable)
      .leftJoin(syncChangeLogTable, eq(syncChangeLogTable.changeId, syncConflictTable.changeId))
      .where(eq(syncConflictTable.id, input.conflictId))
      .limit(1);
    if (!row) throw new Error("SYNC_CONFLICT_NOT_FOUND");
    if (row.conflict.status === "resolved") return row.conflict;

    let resolution = input.resolution;
    if (input.resolution === "correct") {
      if (!row.change) throw new Error("SYNC_CONFLICT_CHANGE_NOT_FOUND");
      const node = await ensureNodeIdentity("web");
      await recordLocalChange(tx, {
        nodeId: node.nodeId,
        entityType: row.change.entityType,
        globalId: row.change.entityGlobalId,
        changeType: "correction",
        payload: input.correction!,
        parentRevision: row.change.parentRevision,
      });
      resolution = "correct";
    }

    const [updated] = await tx
      .update(syncConflictTable)
      .set({
        status: resolution === "defer" ? "deferred" : "resolved",
        resolvedBy: input.userId,
        resolution,
        resolvedAt: resolution === "defer" ? null : new Date(),
      })
      .where(and(eq(syncConflictTable.id, input.conflictId), eq(syncConflictTable.status, "open")))
      .returning();
    if (!updated) throw new Error("SYNC_CONFLICT_ALREADY_RESOLVED");
    return updated;
  });
}