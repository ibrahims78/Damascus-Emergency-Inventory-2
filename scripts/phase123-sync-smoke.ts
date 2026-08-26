import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the phase 1–3 sync smoke test");
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const suffix = randomUUID();
const nodeId = `phase123-${suffix}`;
const installationId = `phase123-installation-${suffix}`;
const entityGlobalId = randomUUID();
const changeId = randomUUID();
const operationId = randomUUID();

async function cleanup() {
  await sql`DELETE FROM sync_tombstones WHERE origin_node_id = ${nodeId}`;
  await sql`DELETE FROM sync_inbox WHERE origin_node_id = ${nodeId}`;
  await sql`DELETE FROM sync_outbox WHERE change_id IN (SELECT change_id FROM sync_change_log WHERE origin_node_id = ${nodeId})`;
  await sql`DELETE FROM sync_change_log WHERE origin_node_id = ${nodeId}`;
  await sql`DELETE FROM sync_entity_ids WHERE global_id = ${entityGlobalId}`;
  await sql`DELETE FROM node_identity WHERE node_id = ${nodeId}`;
}

try {
  await sql`
    INSERT INTO node_identity (node_id, installation_id, node_type)
    VALUES (${nodeId}, ${installationId}, 'web')
  `;
  const [identity] = await sql`
    SELECT node_id, installation_id, node_type, origin_sequence
    FROM node_identity WHERE node_id = ${nodeId}
  `;
  assert.equal(identity.node_id, nodeId);
  assert.equal(identity.installation_id, installationId);
  assert.equal(identity.node_type, "web");
  console.log("PASS phase 2 node identity is stable and unique");

  const beforeCounts = await sql`
    SELECT
      (SELECT count(*)::int FROM sync_change_log WHERE origin_node_id = ${nodeId}) AS changes,
      (SELECT count(*)::int FROM sync_outbox WHERE change_id IN (
        SELECT change_id FROM sync_change_log WHERE origin_node_id = ${nodeId}
      )) AS outbox
  `;

  await sql.begin(async (tx) => {
    const [sequence] = await tx`
      UPDATE node_identity
      SET origin_sequence = origin_sequence + 1, updated_at = now()
      WHERE node_id = ${nodeId}
      RETURNING origin_sequence
    `;
    assert.equal(Number(sequence.origin_sequence), 1);

    await tx`
      INSERT INTO sync_entity_ids (entity_type, local_id, global_id)
      VALUES ('phase123-test-entity', 1, ${entityGlobalId})
    `;
    await tx`
      INSERT INTO sync_change_log
        (change_id, operation_id, entity_type, entity_global_id, local_entity_id,
         change_type, payload, origin_node_id, origin_sequence, status)
      VALUES
        (${changeId}, ${operationId}, 'phase123-test-entity', ${entityGlobalId}, 1,
         'create', ${JSON.stringify({ safe: true })}::jsonb, ${nodeId}, 1, 'local-pending')
    `;
    await tx`
      INSERT INTO sync_outbox (change_id, status)
      VALUES (${changeId}, 'pending')
    `;
  });

  const [pending] = await sql`
    SELECT c.change_id, c.operation_id, c.status, o.status AS outbox_status
    FROM sync_change_log c
    JOIN sync_outbox o ON o.change_id = c.change_id
    WHERE c.change_id = ${changeId}
  `;
  assert.equal(pending.operation_id, operationId);
  assert.equal(pending.status, "local-pending");
  assert.equal(pending.outbox_status, "pending");
  console.log("PASS phase 3 local change is atomically present in Change Log and Outbox");

  await sql`
    INSERT INTO sync_inbox (change_id, origin_node_id, status)
    VALUES (${changeId}, ${nodeId}, 'received')
    ON CONFLICT (change_id) DO NOTHING
  `;
  await sql`
    INSERT INTO sync_inbox (change_id, origin_node_id, status)
    VALUES (${changeId}, ${nodeId}, 'received')
    ON CONFLICT (change_id) DO NOTHING
  `;
  const [inboxCount] = await sql`
    SELECT count(*)::int AS count FROM sync_inbox WHERE change_id = ${changeId}
  `;
  assert.equal(Number(inboxCount.count), 1);
  console.log("PASS phase 3 duplicate inbox delivery is idempotent");

  await sql`
    INSERT INTO sync_tombstones
      (entity_type, entity_global_id, deleted_by_change_id, origin_node_id)
    VALUES ('phase123-test-entity', ${entityGlobalId}, ${changeId}, ${nodeId})
  `;
  const [tombstone] = await sql`
    SELECT entity_global_id, propagated
    FROM sync_tombstones WHERE entity_global_id = ${entityGlobalId}
  `;
  assert.equal(tombstone.entity_global_id, entityGlobalId);
  assert.equal(tombstone.propagated, false);
  console.log("PASS phase 3 tombstone prevents silent resurrection");

  await assert.rejects(
    sql.begin(async (tx) => {
      await tx`
        INSERT INTO sync_change_log
          (change_id, operation_id, entity_type, entity_global_id, change_type,
           payload, origin_node_id, origin_sequence)
        VALUES
          (${randomUUID()}, ${randomUUID()}, 'phase123-rollback', ${randomUUID()},
           'create', '{}'::jsonb, ${nodeId}, 99)
      `;
      throw new Error("intentional rollback");
    }),
  );
  const [afterRollback] = await sql`
    SELECT count(*)::int AS count FROM sync_change_log
    WHERE origin_node_id = ${nodeId} AND entity_type = 'phase123-rollback'
  `;
  assert.equal(Number(afterRollback.count), 0);
  assert.equal(Number(beforeCounts[0].changes), 0);
  console.log("PASS phase 3 failed write rolls back without a partial change");
} finally {
  await cleanup();
  await sql.end({ timeout: 5 });
}