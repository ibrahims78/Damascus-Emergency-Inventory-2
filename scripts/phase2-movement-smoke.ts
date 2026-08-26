import assert from "node:assert/strict";
import postgres from "postgres";
import { createInventoryMovement } from "../artifacts/api-server/src/lib/inventory-movement-service";
import { InventoryMovementError } from "../artifacts/api-server/src/lib/inventory-movement-core";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the phase-two movement smoke test");
}

const sql = postgres(process.env.DATABASE_URL, { max: 4 });
const suffix = `${Date.now()}`;
const username = `__phase2_smoke_${suffix}`;
let userId = 0;
let itemId = 0;
let concurrentItemId = 0;
let equipmentId = 0;
let recipientId = 0;
let exitReasonId = 0;

const context = () => ({
  userId,
  userName: "Phase 2 smoke test",
  ipAddress: "127.0.0.1",
});

async function cleanup() {
  if (!userId) return;
  await sql.begin(async (tx) => {
    await tx`
      DELETE FROM damage_records
      WHERE created_by = ${userId}
    `;
    await tx`
      DELETE FROM custody_returns
      WHERE created_by = ${userId}
    `;
    await tx`
      DELETE FROM central_returns
      WHERE created_by = ${userId}
    `;
    await tx`
      DELETE FROM personal_custodies
      WHERE created_by = ${userId}
    `;
    await tx`
      DELETE FROM transaction_batch_allocations
      WHERE transaction_id IN (
        SELECT id FROM transactions WHERE created_by = ${userId}
      )
    `;
    await tx`
      DELETE FROM inventory_batches
      WHERE source_transaction_id IN (
        SELECT id FROM transactions WHERE created_by = ${userId}
      )
    `;
    await tx`
      DELETE FROM audit_log
      WHERE user_id = ${userId}
    `;
    await tx`
      DELETE FROM transactions
      WHERE created_by = ${userId}
    `;
    if (itemId) await tx`DELETE FROM items WHERE id = ${itemId}`;
    if (concurrentItemId) await tx`DELETE FROM items WHERE id = ${concurrentItemId}`;
    if (equipmentId) await tx`DELETE FROM equipment WHERE id = ${equipmentId}`;
    if (recipientId) await tx`DELETE FROM recipients WHERE id = ${recipientId}`;
    if (exitReasonId) await tx`DELETE FROM exit_reasons WHERE id = ${exitReasonId}`;
    await tx`DELETE FROM users WHERE id = ${userId}`;
  });
}

try {
  const [user] = await sql`
    INSERT INTO users (username, password_hash, full_name, role, is_active)
    VALUES (${username}, 'phase2-smoke-no-login', 'Phase 2 smoke test', 'admin', true)
    RETURNING id
  `;
  userId = Number(user.id);
  const [item] = await sql`
    INSERT INTO items (name, item_type, unit, current_stock, min_stock)
    VALUES (${`__phase2_item_${suffix}`}, 'item', 'unit', 0, 0)
    RETURNING id
  `;
  itemId = Number(item.id);
  const [concurrentItem] = await sql`
    INSERT INTO items (name, item_type, unit, current_stock, min_stock)
    VALUES (${`__phase2_concurrent_item_${suffix}`}, 'item', 'unit', 0, 0)
    RETURNING id
  `;
  concurrentItemId = Number(concurrentItem.id);
  const [equipment] = await sql`
    INSERT INTO equipment (name, condition, quantity, min_quantity)
    VALUES (${`__phase2_equipment_${suffix}`}, 'good', 2, 0)
    RETURNING id
  `;
  equipmentId = Number(equipment.id);
  const [recipient] = await sql`
    INSERT INTO recipients (name)
    VALUES (${`__phase2_recipient_${suffix}`})
    RETURNING id
  `;
  recipientId = Number(recipient.id);
  const [exitReason] = await sql`
    INSERT INTO exit_reasons (name)
    VALUES (${`__phase2_reason_${suffix}`})
    RETURNING id
  `;
  exitReasonId = Number(exitReason.id);

  const concurrentMovements = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      createInventoryMovement(
        {
          kind: "in",
          itemType: "item",
          itemId: concurrentItemId,
          quantity: 1,
          deliveryNoteNumber: `PHASE2-CONCURRENT-${suffix}-${index}`,
          deliveryNoteDate: "2099-01-01",
        },
        context(),
      ),
    ),
  );
  assert.equal(
    new Set(concurrentMovements.map((movement) => movement.documentNumber)).size,
    20,
  );
  console.log("PASS concurrent document numbers (20 operations)");

  await createInventoryMovement(
    {
      kind: "in",
      itemType: "item",
      itemId,
      quantity: 10,
      deliveryNoteNumber: `PHASE2-IN-${suffix}-A`,
      deliveryNoteDate: "2099-01-01",
      expiryDate: "2099-01-01",
      batchNumber: "BATCH-A",
    },
    context(),
  );
  const secondInbound = await createInventoryMovement(
    {
      kind: "in",
      itemType: "item",
      itemId,
      quantity: 5,
      deliveryNoteNumber: `PHASE2-IN-${suffix}-B`,
      deliveryNoteDate: "2099-01-02",
      expiryDate: "2099-02-01",
      batchNumber: "BATCH-B",
    },
    context(),
  );
  assert.match(secondInbound.documentNumber, /^IN-\d{4}-\d{4}$/);

  const outbound = await createInventoryMovement(
    {
      kind: "out",
      itemType: "item",
      itemId,
      quantity: 12,
      recipientId,
      exitReasonId,
      internalDeliveryNoteNumber: `PHASE2-OUT-${suffix}-A`,
      internalDeliveryNoteDate: "2099-01-03",
      deliveryDestination: "ambulance_point",
    },
    context(),
  );
  const [stock] = await sql`
    SELECT current_stock FROM items WHERE id = ${itemId}
  `;
  assert.equal(Number(stock.current_stock), 3);
  const allocations = await sql`
    SELECT quantity
    FROM transaction_batch_allocations
    WHERE transaction_id = ${outbound.id}
    ORDER BY id
  `;
  assert.deepEqual(
    allocations.map((row) => Number(row.quantity)),
    [10, 2],
  );
  console.log("PASS atomic inbound + FEFO outbound (2 batches)");

  let insufficient = false;
  try {
    await createInventoryMovement(
      {
        kind: "out",
        itemType: "item",
        itemId,
        quantity: 4,
        recipientId,
        exitReasonId,
        internalDeliveryNoteNumber: `PHASE2-OUT-${suffix}-B`,
        internalDeliveryNoteDate: "2099-01-04",
        deliveryDestination: "administrative_building",
      },
      context(),
    );
  } catch (error) {
    insufficient =
      error instanceof InventoryMovementError &&
      error.code === "INSUFFICIENT_BATCH_STOCK";
  }
  assert.equal(insufficient, true);
  const [failedAudit] = await sql`
    SELECT count(*)::int AS count
    FROM audit_log
    WHERE user_id = ${userId} AND action = 'movement_failed'
  `;
  assert.equal(Number(failedAudit.count), 1);
  console.log("PASS insufficient stock rollback + failure audit");

  const custodyOut = await createInventoryMovement(
    {
      kind: "custody_out",
      itemType: "equipment",
      equipmentId,
      quantity: 1,
      holderName: "Phase 2 Holder",
      custodyNoteNumber: `CUST-${suffix}`,
      custodyDate: "2099-01-01",
      custodyLocation: "Phase 2 Location",
    },
    context(),
  );
  const [equipmentAfterCustody] = await sql`
    SELECT quantity FROM equipment WHERE id = ${equipmentId}
  `;
  assert.equal(Number(equipmentAfterCustody.quantity), 2);
  const [custody] = await sql`
    SELECT id, quantity, returned_quantity
    FROM personal_custodies
    WHERE source_transaction_id = ${custodyOut.id}
  `;
  assert.equal(Number(custody.quantity), 1);
  assert.equal(Number(custody.returned_quantity), 0);

  await createInventoryMovement(
    {
      kind: "custody_return",
      custodyId: Number(custody.id),
      quantity: 1,
      returnCondition: "good",
      returnedToLocation: "Central Store",
      documentDate: "2099-02-01",
    },
    context(),
  );
  const [returnedCustody] = await sql`
    SELECT status, returned_quantity
    FROM personal_custodies
    WHERE id = ${custody.id}
  `;
  assert.equal(returnedCustody.status, "returned");
  assert.equal(Number(returnedCustody.returned_quantity), 1);
  console.log("PASS equipment custody without stock decrement + return");

  await createInventoryMovement(
    {
      kind: "damage",
      itemType: "equipment",
      equipmentId,
      quantity: 1,
      reason: "Phase 2 smoke equipment damage",
      damageDate: "2099-02-15",
    },
    context(),
  );
  await createInventoryMovement(
    {
      kind: "central_return",
      itemType: "equipment",
      equipmentId,
      quantity: 1,
      returnCondition: "damaged",
      reason: "Phase 2 smoke equipment return",
      documentDate: "2099-02-20",
    },
    context(),
  );
  const [equipmentAfterEvents] = await sql`
    SELECT quantity FROM equipment WHERE id = ${equipmentId}
  `;
  assert.equal(Number(equipmentAfterEvents.quantity), 0);
  console.log("PASS equipment damage + central return balance effects");

  await createInventoryMovement(
    {
      kind: "damage",
      itemType: "item",
      itemId,
      quantity: 2,
      reason: "Phase 2 smoke damage",
      damageDate: "2099-03-01",
    },
    context(),
  );
  const [stockAfterDamage] = await sql`
    SELECT current_stock FROM items WHERE id = ${itemId}
  `;
  assert.equal(Number(stockAfterDamage.current_stock), 1);

  await createInventoryMovement(
    {
      kind: "central_return",
      itemType: "item",
      itemId,
      quantity: 1,
      returnCondition: "good",
      reason: "Phase 2 smoke central return",
      documentDate: "2099-04-01",
    },
    context(),
  );
  const [finalStock] = await sql`
    SELECT current_stock FROM items WHERE id = ${itemId}
  `;
  assert.equal(Number(finalStock.current_stock), 0);
  await createInventoryMovement(
    {
      kind: "adjust",
      itemId,
      newStock: 2,
      reason: "Phase 2 smoke inventory reconciliation",
    },
    context(),
  );
  const [adjustedStock] = await sql`
    SELECT current_stock FROM items WHERE id = ${itemId}
  `;
  assert.equal(Number(adjustedStock.current_stock), 2);
  const [successAudits] = await sql`
    SELECT count(*)::int AS count
    FROM audit_log
    WHERE user_id = ${userId} AND action = 'movement_created'
  `;
  assert.equal(Number(successAudits.count), 30);
  console.log("PASS damage + central return atomic balance effects");
  console.log("Phase 2 movement smoke tests passed (6 scenarios).");
} finally {
  await cleanup();
  await sql.end({ timeout: 5 });
}