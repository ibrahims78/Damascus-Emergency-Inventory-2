import assert from "node:assert/strict";
import postgres from "postgres";
import {
  createInventoryMovement,
} from "../artifacts/api-server/src/lib/inventory-movement-service";
import { InventoryMovementError } from "../artifacts/api-server/src/lib/inventory-movement-core";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the phase-three inbound smoke test");
}

const sql = postgres(process.env.DATABASE_URL);
const suffix = `${Date.now()}`;
let userId = 0;
let itemId = 0;
let equipmentId = 0;

const context = () => ({
  userId,
  userName: "Phase 3 inbound smoke test",
  ipAddress: "127.0.0.1",
});

async function cleanup() {
  if (!userId) return;
  await sql.begin(async (tx) => {
    await tx`
      DELETE FROM transaction_batch_allocations
      WHERE transaction_id IN (SELECT id FROM transactions WHERE created_by = ${userId})
    `;
    await tx`
      DELETE FROM inventory_batches
      WHERE source_transaction_id IN (SELECT id FROM transactions WHERE created_by = ${userId})
    `;
    await tx`DELETE FROM audit_log WHERE user_id = ${userId}`;
    await tx`DELETE FROM transactions WHERE created_by = ${userId}`;
    if (itemId) await tx`DELETE FROM items WHERE id = ${itemId}`;
    if (equipmentId) await tx`DELETE FROM equipment WHERE id = ${equipmentId}`;
    await tx`DELETE FROM users WHERE id = ${userId}`;
  });
}

try {
  const [user] = await sql`
    INSERT INTO users (username, password_hash, full_name, role, is_active)
    VALUES (${`__phase3_inbound_${suffix}`}, 'phase3-smoke-no-login', 'Phase 3 inbound smoke test', 'admin', true)
    RETURNING id
  `;
  userId = Number(user.id);

  const [item] = await sql`
    INSERT INTO items (name, item_type, unit, current_stock, min_stock)
    VALUES (${`__phase3_item_${suffix}`}, 'item', 'unit', 0, 0)
    RETURNING id
  `;
  itemId = Number(item.id);

  const [equipment] = await sql`
    INSERT INTO equipment (name, condition, quantity, min_quantity)
    VALUES (${`__phase3_equipment_${suffix}`}, 'good', 0, 0)
    RETURNING id
  `;
  equipmentId = Number(equipment.id);

  const firstInbound = await createInventoryMovement(
    {
      kind: "in",
      itemType: "item",
      itemId,
      quantity: 4,
      deliveryNoteNumber: `PHASE3-${suffix}-A`,
      deliveryNoteDate: "2099-01-01",
      batchNumber: "BATCH-A",
    },
    context(),
  );
  assert.equal(firstInbound.deliveryNoteNumber, `PHASE3-${suffix}-A`);
  assert.equal(firstInbound.deliveryNoteDate, "2099-01-01");
  assert.equal(firstInbound.supplySource, "central_warehouses");
  assert.equal(firstInbound.expiryDate, null);
  console.log("PASS inbound item with central note and no expiry");

  await createInventoryMovement(
    {
      kind: "in",
      itemType: "item",
      itemId,
      quantity: 6,
      deliveryNoteNumber: `PHASE3-${suffix}-B`,
      deliveryNoteDate: "2099-02-01",
      expiryDate: "2099-12-31",
      batchNumber: "BATCH-B",
    },
    context(),
  );
  const batches = await sql`
    SELECT batch_number, received_quantity, expiry_date
    FROM inventory_batches
    WHERE item_id = ${itemId}
    ORDER BY id
  `;
  assert.deepEqual(
    batches.map((batch) => [
      batch.batch_number,
      Number(batch.received_quantity),
      batch.expiry_date
        ? new Date(batch.expiry_date).toISOString().slice(0, 10)
        : null,
    ]),
    [
      ["BATCH-A", 4, null],
      ["BATCH-B", 6, "2099-12-31"],
    ],
  );
  console.log("PASS two inbound batches remain independently traceable");

  for (const invalidInput of [
    {
      deliveryNoteNumber: "",
      deliveryNoteDate: "2099-03-01",
      expectedCode: "REQUIRED_FIELD",
    },
    {
      deliveryNoteNumber: `PHASE3-${suffix}-INVALID`,
      deliveryNoteDate: "2099-02-30",
      expectedCode: "INVALID_DATE",
    },
  ]) {
    await assert.rejects(
      createInventoryMovement(
        {
          kind: "in",
          itemType: "item",
          itemId,
          quantity: 1,
          deliveryNoteNumber: invalidInput.deliveryNoteNumber,
          deliveryNoteDate: invalidInput.deliveryNoteDate,
        },
        context(),
      ),
      (error: unknown) =>
        error instanceof InventoryMovementError &&
        error.code === invalidInput.expectedCode,
    );
  }
  const [stockAfterInvalid] = await sql`
    SELECT current_stock FROM items WHERE id = ${itemId}
  `;
  assert.equal(Number(stockAfterInvalid.current_stock), 10);
  console.log("PASS invalid note/date rejected without changing stock");

  const equipmentInbound = await createInventoryMovement(
    {
      kind: "in",
      itemType: "equipment",
      equipmentId,
      deliveryNoteNumber: `PHASE3-${suffix}-E`,
      deliveryNoteDate: "2099-04-01",
    },
    context(),
  );
  assert.equal(equipmentInbound.deliveryNoteDate, "2099-04-01");
  const [equipmentStock] = await sql`
    SELECT quantity FROM equipment WHERE id = ${equipmentId}
  `;
  assert.equal(Number(equipmentStock.quantity), 1);
  console.log("PASS equipment inbound uses the same delivery-note contract");

  console.log("Phase 3 inbound smoke tests passed (4 scenarios).");
} finally {
  await cleanup();
  await sql.end({ timeout: 5 });
}