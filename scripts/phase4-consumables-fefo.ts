import assert from "node:assert/strict";
import postgres from "postgres";
import { createInventoryMovement } from "../artifacts/api-server/src/lib/inventory-movement-service";
import { InventoryMovementError } from "../artifacts/api-server/src/lib/inventory-movement-core";

/**
 * المرحلة الرابعة — اختبار إخراج المواد المستهلكة وتوثيق قواعدها
 *
 * قواعد الاختبار:
 * 1. مسار out يقبل المواد المستهلكة فقط، ويمنع إخراج التجهيزات من هذا المسار.
 * 2. رقم وتاريخ مذكرة التسليم الداخلية وجهة التسليم (مبنى إداري/نقطة إسعاف)
 *    حقول إلزامية، والجهة/المستلم يجب أن تكون فعالة وموجودة في القائمة.
 * 3. يطبق النظام FEFO: الصلاحية الأقرب أولًا، مع استبعاد الدفعات المنتهية،
 *    وتوزيع الكمية على دفعات متعددة عند الحاجة.
 * 4. تحفظ كل تخصيصات الدفعات، وتفشل العملية ذريًا عند عدم كفاية الرصيد؛
 *    فلا يتغير رصيد المادة أو الدفعات عند الفشل.
 *
 * تشغيل:
 *   pnpm --filter @workspace/scripts run phase4:consumables-fefo
 */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the phase-four FEFO test");
}

const sql = postgres(process.env.DATABASE_URL);
const suffix = `${Date.now()}`;
let userId = 0;
let itemId = 0;
let equipmentId = 0;
let recipientId = 0;
let exitReasonId = 0;

const context = () => ({
  userId,
  userName: "Phase 4 consumables FEFO test",
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
    if (recipientId) await tx`DELETE FROM recipients WHERE id = ${recipientId}`;
    if (exitReasonId) await tx`DELETE FROM exit_reasons WHERE id = ${exitReasonId}`;
    if (itemId) await tx`DELETE FROM items WHERE id = ${itemId}`;
    if (equipmentId) await tx`DELETE FROM equipment WHERE id = ${equipmentId}`;
    await tx`DELETE FROM users WHERE id = ${userId}`;
  });
}

function validOut(overrides: Record<string, unknown> = {}) {
  return {
    kind: "out" as const,
    itemType: "item" as const,
    itemId,
    quantity: 1,
    recipientId,
    exitReasonId,
    internalDeliveryNoteNumber: `PHASE4-OUT-${suffix}`,
    internalDeliveryNoteDate: "2099-02-01",
    deliveryDestination: "ambulance_point" as const,
    ...overrides,
  };
}

try {
  const [user] = await sql`
    INSERT INTO users (username, password_hash, full_name, role, is_active)
    VALUES (${`__phase4_fefo_${suffix}`}, 'phase4-smoke-no-login', 'Phase 4 FEFO test', 'admin', true)
    RETURNING id
  `;
  userId = Number(user.id);

  const [item] = await sql`
    INSERT INTO items (name, item_type, unit, current_stock, min_stock)
    VALUES (${`__phase4_item_${suffix}`}, 'item', 'unit', 0, 0)
    RETURNING id
  `;
  itemId = Number(item.id);

  const [equipment] = await sql`
    INSERT INTO equipment (name, condition, quantity, min_quantity)
    VALUES (${`__phase4_equipment_${suffix}`}, 'good', 1, 0)
    RETURNING id
  `;
  equipmentId = Number(equipment.id);

  const [recipient] = await sql`
    INSERT INTO recipients (name, is_active)
    VALUES (${`__phase4_recipient_${suffix}`}, true)
    RETURNING id
  `;
  recipientId = Number(recipient.id);

  const [reason] = await sql`
    INSERT INTO exit_reasons (name, is_active)
    VALUES (${`__phase4_reason_${suffix}`}, true)
    RETURNING id
  `;
  exitReasonId = Number(reason.id);

  await createInventoryMovement(
    {
      kind: "in",
      itemType: "item",
      itemId,
      quantity: 4,
      deliveryNoteNumber: `PHASE4-IN-${suffix}-A`,
      deliveryNoteDate: "2099-01-01",
      expiryDate: "2099-03-01",
      batchNumber: "FEFO-NEAR",
    },
    context(),
  );
  await createInventoryMovement(
    {
      kind: "in",
      itemType: "item",
      itemId,
      quantity: 6,
      deliveryNoteNumber: `PHASE4-IN-${suffix}-B`,
      deliveryNoteDate: "2099-01-02",
      expiryDate: "2099-12-31",
      batchNumber: "FEFO-FAR",
    },
    context(),
  );
  await createInventoryMovement(
    {
      kind: "in",
      itemType: "item",
      itemId,
      quantity: 3,
      deliveryNoteNumber: `PHASE4-IN-${suffix}-EXPIRED`,
      deliveryNoteDate: "2099-01-03",
      expiryDate: "2020-01-01",
      batchNumber: "FEFO-EXPIRED",
    },
    context(),
  );
  console.log("PASS test fixture creates three traceable batches");

  for (const invalidInput of [
    { internalDeliveryNoteNumber: "", expectedCode: "REQUIRED_FIELD" },
    { internalDeliveryNoteDate: "2099-02-30", expectedCode: "INVALID_DATE" },
    { deliveryDestination: "warehouse" as const, expectedCode: "INVALID_DELIVERY_DESTINATION" },
    { recipientId: null, expectedCode: "RECIPIENT_REQUIRED" },
  ]) {
    await assert.rejects(
      createInventoryMovement(validOut(invalidInput), context()),
      (error: unknown) =>
        error instanceof InventoryMovementError && error.code === invalidInput.expectedCode,
    );
  }
  const [stockAfterValidationFailures] = await sql`
    SELECT current_stock FROM items WHERE id = ${itemId}
  `;
  assert.equal(Number(stockAfterValidationFailures.current_stock), 13);
  console.log("PASS required note, date, destination, and recipient validation");

  await assert.rejects(
    createInventoryMovement(
      validOut({
        itemType: "equipment",
        itemId: null,
        equipmentId,
        internalDeliveryNoteNumber: `PHASE4-EQUIPMENT-${suffix}`,
      }),
      context(),
    ),
    (error: unknown) =>
      error instanceof InventoryMovementError && error.code === "EQUIPMENT_CUSTODY_REQUIRED",
  );
  console.log("PASS equipment cannot use the consumables out route");

  const outbound = await createInventoryMovement(
    validOut({ quantity: 7, internalDeliveryNoteNumber: `PHASE4-OUT-${suffix}-FEFO` }),
    context(),
  );
  assert.equal(outbound.internalDeliveryNoteNumber, `PHASE4-OUT-${suffix}-FEFO`);
  assert.equal(outbound.internalDeliveryNoteDate, "2099-02-01");
  assert.equal(outbound.deliveryDestination, "ambulance_point");

  const allocations = await sql`
    SELECT a.quantity, a.batch_number_snap, a.expiry_date_snap
    FROM transaction_batch_allocations a
    WHERE a.transaction_id = ${outbound.id}
    ORDER BY a.id
  `;
  assert.deepEqual(
    allocations.map((row) => [
      Number(row.quantity),
      row.batch_number_snap,
      row.expiry_date_snap ? new Date(row.expiry_date_snap).toISOString().slice(0, 10) : null,
    ]),
    [
      [4, "FEFO-NEAR", "2099-03-01"],
      [3, "FEFO-FAR", "2099-12-31"],
    ],
  );
  const [stockAfterFefo] = await sql`
    SELECT current_stock FROM items WHERE id = ${itemId}
  `;
  assert.equal(Number(stockAfterFefo.current_stock), 6);
  const remainingBatches = await sql`
    SELECT batch_number, remaining_quantity
    FROM inventory_batches
    WHERE item_id = ${itemId}
    ORDER BY id
  `;
  assert.deepEqual(
    remainingBatches.map((row) => [row.batch_number, Number(row.remaining_quantity)]),
    [
      ["FEFO-NEAR", 0],
      ["FEFO-FAR", 3],
      ["FEFO-EXPIRED", 3],
    ],
  );
  console.log("PASS FEFO skips expired stock and splits one output across two batches");

  await assert.rejects(
    createInventoryMovement(
      validOut({
        quantity: 4,
        internalDeliveryNoteNumber: `PHASE4-OUT-${suffix}-INSUFFICIENT`,
        deliveryDestination: "administrative_building",
      }),
      context(),
    ),
    (error: unknown) =>
      error instanceof InventoryMovementError && error.code === "INSUFFICIENT_BATCH_STOCK",
  );
  const [stockAfterInsufficient] = await sql`
    SELECT current_stock FROM items WHERE id = ${itemId}
  `;
  assert.equal(Number(stockAfterInsufficient.current_stock), 6);
  const [farBatchAfterInsufficient] = await sql`
    SELECT remaining_quantity
    FROM inventory_batches
    WHERE item_id = ${itemId} AND batch_number = 'FEFO-FAR'
  `;
  assert.equal(Number(farBatchAfterInsufficient.remaining_quantity), 3);
  console.log("PASS insufficient valid batches roll back without changing stock");

  console.log("Phase 4 consumables FEFO tests passed (6 scenarios).");
} finally {
  await cleanup();
  await sql.end({ timeout: 5 });
}