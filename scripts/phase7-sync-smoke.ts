import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import {
  applySyncPackage,
  acknowledgeSyncPackage,
  computeSyncPackageHash,
  createSyncSession,
  ensureNodeIdentity,
  getSyncNode,
  prepareSyncPackage,
  recordLocalChange,
} from "../artifacts/api-server/src/lib/sync-service.ts";
import { db } from "../lib/db/src/index.ts";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the phase seven sync smoke test");
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const suffix = randomUUID();
const remoteNodeId = `phase7-remote-${suffix}`;
const remoteEntityId = randomUUID();
const remoteChangeIds: string[] = [];
let localChangeId = "";
let sessionId = "";

async function cleanup() {
  await sql`DELETE FROM sync_session_packages WHERE session_id = ${sessionId}`;
  await sql`DELETE FROM sync_sessions WHERE session_id = ${sessionId}`;
  if (localChangeId) {
    await sql`DELETE FROM sync_outbox WHERE change_id = ${localChangeId}`;
    await sql`DELETE FROM sync_change_log WHERE change_id = ${localChangeId}`;
  }
  if (remoteChangeIds.length) {
    await sql`DELETE FROM sync_inbox WHERE change_id = ANY(${sql.array(remoteChangeIds)})`;
    await sql`DELETE FROM sync_outbox WHERE change_id = ANY(${sql.array(remoteChangeIds)})`;
    await sql`DELETE FROM sync_change_log WHERE change_id = ANY(${sql.array(remoteChangeIds)})`;
  }
  await sql`DELETE FROM sync_cursors WHERE peer_node_id = ${remoteNodeId}`;
  await sql`DELETE FROM sync_tombstones WHERE origin_node_id = ${remoteNodeId}`;
}

function remoteChange(changeId: string, sequence: number) {
  return {
    changeId,
    operationId: randomUUID(),
    entityType: "phase7-test-entity",
    entityGlobalId: remoteEntityId,
    localEntityId: null,
    changeType: "create" as const,
    payload: { sequence, source: "phase7-smoke" },
    originNodeId: remoteNodeId,
    originSequence: sequence,
    causedByChangeId: null,
    parentRevision: null,
    createdAt: new Date().toISOString(),
  };
}

try {
  const node = await ensureNodeIdentity("web");
  const beforeVector = (await getSyncNode()).vector;
  const created = await createSyncSession({
    targetNodeId: `phase7-target-${suffix}`,
  });
  sessionId = created.sessionId;

  const local = await db.transaction(async (tx) =>
    recordLocalChange(tx, {
      nodeId: node.nodeId,
      entityType: "phase7-test-entity",
      payload: { source: "local", suffix },
      changeType: "create",
    }),
  );
  localChangeId = local.changeId;

  const outgoing = await prepareSyncPackage(sessionId, node.nodeId, beforeVector);
  const repeatedOutgoing = await prepareSyncPackage(sessionId, node.nodeId, beforeVector);
  assert.equal(outgoing.packageId, repeatedOutgoing.packageId);
  assert.equal(Array.isArray(outgoing.changes), true);
  assert.equal((outgoing.changes as unknown[]).length, 1);
  console.log("PASS phase 7 A→B delta includes only changes after the exchanged vector");
  console.log("PASS phase 7 repeated manifest is idempotent");

  const targetNodeId = `phase7-target-${suffix}`;
  const baseVector = { ...beforeVector };
  const first = remoteChange(randomUUID(), 1);
  remoteChangeIds.push(first.changeId);
  const firstLastVector = { ...baseVector, [remoteNodeId]: 1 };
  const firstHash = computeSyncPackageHash({
    sessionId,
    direction: "source-to-target",
    baseVector,
    lastVector: firstLastVector,
    changes: [first],
  });
  const firstReport = await applySyncPackage({
    sessionId,
    nodeId: targetNodeId,
    packageId: randomUUID(),
    direction: "source-to-target",
    baseVector,
    lastVector: firstLastVector,
    contentHash: firstHash,
    changes: [first],
  });
  assert.equal(firstReport.counts.applied, 1);
  assert.equal(firstReport.counts.duplicate, 0);
  console.log("PASS phase 7 B receives A package and applies it atomically to Inbox/Change Log");

  const duplicateReport = await applySyncPackage({
    sessionId,
    nodeId: targetNodeId,
    packageId: firstReport.packageId,
    direction: "source-to-target",
    baseVector,
    lastVector: firstLastVector,
    contentHash: firstHash,
    changes: [first],
  });
  assert.equal(duplicateReport.counts.applied, 1);
  const [inboxAfterDuplicate] = await sql`
    SELECT count(*)::int AS count FROM sync_inbox WHERE change_id = ${first.changeId}
  `;
  assert.equal(Number(inboxAfterDuplicate.count), 1);
  console.log("PASS phase 7 sending the same package twice does not duplicate Inbox/Change Log");

  const gap = remoteChange(randomUUID(), 3);
  remoteChangeIds.push(gap.changeId);
  const gapBase = { ...baseVector, [remoteNodeId]: 1 };
  const gapLast = { ...gapBase, [remoteNodeId]: 3 };
  const gapHash = computeSyncPackageHash({
    sessionId,
    direction: "source-to-target",
    baseVector: gapBase,
    lastVector: gapLast,
    changes: [gap],
  });
  await assert.rejects(
    applySyncPackage({
      sessionId,
      nodeId: targetNodeId,
      packageId: randomUUID(),
      direction: "source-to-target",
      baseVector: gapBase,
      lastVector: gapLast,
      contentHash: gapHash,
      changes: [gap],
    }),
    /SYNC_SEQUENCE_GAP/,
  );
  const [gapWasNotApplied] = await sql`
    SELECT count(*)::int AS count FROM sync_change_log WHERE change_id = ${gap.changeId}
  `;
  assert.equal(Number(gapWasNotApplied.count), 0);
  console.log("PASS phase 7 sequence gap is rejected without partial application");

  const second = remoteChange(randomUUID(), 2);
  remoteChangeIds.push(second.changeId);
  const secondLast = { ...gapBase, [remoteNodeId]: 2 };
  const secondHash = computeSyncPackageHash({
    sessionId,
    direction: "source-to-target",
    baseVector: gapBase,
    lastVector: secondLast,
    changes: [second],
  });
  const secondReport = await applySyncPackage({
    sessionId,
    nodeId: targetNodeId,
    packageId: randomUUID(),
    direction: "source-to-target",
    baseVector: gapBase,
    lastVector: secondLast,
    contentHash: secondHash,
    changes: [second],
  });
  assert.equal(secondReport.counts.applied, 1);
  console.log("PASS phase 7 resumed package applies after the missing sequence arrives");

  const acknowledged = await acknowledgeSyncPackage(sessionId, outgoing.packageId, targetNodeId);
  const [outbox] = await sql`
    SELECT status FROM sync_outbox WHERE change_id = ${localChangeId}
  `;
  assert.equal(outbox.status, "acknowledged");
  assert.ok(acknowledged.packages.some((pkg) => pkg.packageId === outgoing.packageId));
  console.log("PASS phase 7 ACK acknowledges the Outbox and persists the session report");
  console.log("Phase 7 sync smoke tests passed (7 checks).");
} finally {
  await cleanup();
  await sql.end({ timeout: 5 });
}