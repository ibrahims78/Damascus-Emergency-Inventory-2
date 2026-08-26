import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import {
  consumePairing,
  createPairing,
  getRelayPackage,
  listRelayPackages,
  revokeTrustedNode,
  uploadRelayPackage,
} from "../artifacts/api-server/src/lib/relay-service.ts";
import { createSyncSession, ensureNodeIdentity, getSyncSession } from "../artifacts/api-server/src/lib/sync-service.ts";
import { db } from "../lib/db/src/index.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for phase eight relay smoke");

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const suffix = randomUUID();
const targetNodeId = `phase8-target-${suffix}`;
const wrongNodeId = `phase8-wrong-${suffix}`;
let sessionId = "";
let relayId = "";

async function cleanup() {
  if (relayId) await sql`DELETE FROM sync_relay_packages WHERE relay_id = ${relayId}`;
  if (sessionId) await sql`DELETE FROM sync_sessions WHERE session_id = ${sessionId}`;
  await sql`DELETE FROM sync_pairings WHERE source_node_id LIKE ${`%${suffix}`}`;
  await sql`DELETE FROM sync_trusted_nodes WHERE node_id LIKE ${`%${suffix}`}`;
}

try {
  const node = await ensureNodeIdentity("web");
  const session = await createSyncSession({ targetNodeId, sessionId: `phase8-session-${suffix}` });
  sessionId = session.sessionId;
  assert.equal(session.sourceNodeId, node.nodeId);

  const pairing = await createPairing({ targetNodeId });
  const trusted = await consumePairing({
    code: pairing.code,
    nodeId: targetNodeId,
    nodeType: "android",
    label: "Phase 8 Android fixture",
  });
  assert.equal(trusted.status, "trusted");
  await assert.rejects(
    consumePairing({ code: pairing.code, nodeId: wrongNodeId, nodeType: "windows" }),
    /SYNC_PAIRING_EXPIRED_OR_USED/,
  );
  console.log("PASS phase 8 pairing is single-use and binds the expected node");

  const concurrentPairing = await createPairing({ targetNodeId: wrongNodeId });
  const concurrentResults = await Promise.allSettled([
    consumePairing({ code: concurrentPairing.code, nodeId: wrongNodeId, nodeType: "windows" }),
    consumePairing({ code: concurrentPairing.code, nodeId: wrongNodeId, nodeType: "windows" }),
  ]);
  assert.equal(concurrentResults.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(concurrentResults.filter((result) => result.status === "rejected").length, 1);
  console.log("PASS phase 8 concurrent pairing consumption claims the code exactly once");

  const payloadBase64 = Buffer.from("opaque-encrypted-dme-sync-fixture", "utf8").toString("base64");
  const uploaded = await uploadRelayPackage({
    sessionId,
    packageId: `phase8-package-${suffix}`,
    direction: "source-to-target",
    sourceNodeId: node.nodeId,
    targetNodeId,
    contentHash: "client-computed-package-hash",
    payloadBase64,
  });
  relayId = uploaded.relayId;
  const repeated = await uploadRelayPackage({
    sessionId,
    packageId: `phase8-package-${suffix}`,
    direction: "source-to-target",
    sourceNodeId: node.nodeId,
    targetNodeId,
    contentHash: "client-computed-package-hash",
    payloadBase64,
  });
  assert.equal(repeated.relayId, relayId);
  const downloaded = await getRelayPackage(relayId, true);
  assert.equal(downloaded.payloadBase64, payloadBase64);
  assert.equal((await listRelayPackages(sessionId)).length, 1);
  console.log("PASS phase 8 Relay stores opaque bytes, supports download, and is idempotent");

  await assert.rejects(
    uploadRelayPackage({
      sessionId,
      packageId: `phase8-wrong-${suffix}`,
      direction: "source-to-target",
      sourceNodeId: wrongNodeId,
      targetNodeId,
      contentHash: "wrong",
      payloadBase64,
    }),
    /SYNC_RELAY_TARGET_INVALID/,
  );
  console.log("PASS phase 8 wrong-node relay upload is rejected");

  await revokeTrustedNode(targetNodeId);
  const target = await getSyncSession(sessionId);
  assert.equal(target.targetNodeId, targetNodeId);
  console.log("PASS phase 8 session remains resumable after trust revocation");
} finally {
  await cleanup();
  await sql.end({ timeout: 2 });
}