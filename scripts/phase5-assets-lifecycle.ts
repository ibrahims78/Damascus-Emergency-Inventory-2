import assert from "node:assert/strict";
import postgres from "postgres";
import { createInventoryMovement } from "../artifacts/api-server/src/lib/inventory-movement-service";
import { InventoryMovementError } from "../artifacts/api-server/src/lib/inventory-movement-core";

/**
 * المرحلة الخامسة — اختبار دورة حياة التجهيزات والعهدة والتلف والإعادة والمرتجع
 *
 * يغطي هذا الاختبار:
 * - تسليم تجهيز كعهدة دون خفض إجمالي التجهيز.
 * - منع تسجيل تلف أو مرتجع لكمية ما زالت داخل عهدة مفتوحة.
 * - الإعادة الجزئية ثم الإعادة الكاملة بحالة مختلفة.
 * - منع إعادة كمية أكبر من المتبقي.
 * - المرتجع المركزي كحركة مستقلة.
 * - منع تسليم أكثر من وحدة للتجهيز ذي الرقم التسلسلي.
 *
 * التشغيل:
 *   pnpm --filter @workspace/scripts run phase5:assets-lifecycle
 */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the phase-five lifecycle test");
}

const sql = postgres(process.env.DATABASE_URL);
const suffix = `${Date.now()}`;
let userId = 0;
let equipmentId = 0;
let serialEquipmentId = 0;
let recipientId = 0;
let custodyId = 0;

const context = () => ({
  userId,
  userName: "Phase 5 assets lifecycle test",
  ipAddress: "127.0.0.1",
});

async function cleanup() {
  if (!userId) return;
  await sql.begin(async (tx) => {
    await tx`DELETE FROM central_returns WHERE created_by = ${userId}`;
    await tx`DELETE FROM custody_returns WHERE created_by = ${userId}`;
    await tx`DELETE FROM damage_records WHERE created_by = ${userId}`;
    await tx`
      DELETE FROM transaction_batch_allocations
      WHERE transaction_id IN (SELECT id FROM transactions WHERE created_by = ${userId})
    `;
    await tx`
      DELETE FROM inventory_batches
      WHERE source_transaction_id IN (SELECT id FROM transactions WHERE created_by = ${userId})
    `;
    await tx`DELETE FROM personal_custodies WHERE created_by = ${userId}`;
    await tx`DELETE FROM audit_log WHERE user_id = ${userId}`;
    await tx`DELETE FROM transactions WHERE created_by = ${userId}`;
    if (recipientId) await tx`DELETE FROM recipients WHERE id = ${recipientId}`;
    if (equipmentId) await tx`DELETE FROM equipment WHERE id = ${equipmentId}`;
    if (serialEquipmentId) await tx`DELETE FROM equipment WHERE id = ${serialEquipmentId}`;
    await tx`DELETE FROM users WHERE id = ${userId}`;
  });
}

function assertMovementError(error: unknown, code: string) {
  return error instanceof InventoryMovementError && error.code === code;
}

try {
  const [user] = await sql`
    INSERT INTO users (username, password_hash, full_name, role, is_active)
    VALUES (${`__phase5_lifecycle_${suffix}`}, 'phase5-smoke-no-login', 'Phase 5 lifecycle test', 'admin', true)
    RETURNING id
  `;
  userId = Number(user.id);

  const [equipment] = await sql`
    INSERT INTO equipment (name, condition, quantity, min_quantity)
    VALUES (${`__phase5_equipment_${suffix}`}, 'good', 3, 0)
    RETURNING id
  `;
  equipmentId = Number(equipment.id);

  const [serialEquipment] = await sql`
    INSERT INTO equipment (name, condition, quantity, min_quantity, serial_number)
    VALUES (${`__phase5_serial_${suffix}`}, 'good', 1, 0, ${`SN-${suffix}`})
    RETURNING id
  `;
  serialEquipmentId = Number(serialEquipment.id);

  const [recipient] = await sql`
    INSERT INTO recipients (name, is_active)
    VALUES (${`__phase5_recipient_${suffix}`}, true)
    RETURNING id
  `;
  recipientId = Number(recipient.id);

  const custodyMovement = await createInventoryMovement(
    {
      kind: "custody_out",
      itemType: "equipment",
      equipmentId,
      quantity: 2,
      recipientId,
      holderName: "مسؤول الإسعاف — اختبار",
      custodyNoteNumber: `PHASE5-CUST-${suffix}`,
      custodyDate: "2099-02-01",
      custodyLocation: "سيارة الإسعاف التجريبية",
    },
    context(),
  );
  const [afterCustody] = await sql`SELECT quantity FROM equipment WHERE id = ${equipmentId}`;
  assert.equal(Number(afterCustody.quantity), 3);
  const [custody] = await sql`
    SELECT id, quantity, returned_quantity, status
    FROM personal_custodies
    WHERE source_transaction_id = ${custodyMovement.id}
  `;
  custodyId = Number(custody.id);
  assert.deepEqual([Number(custody.quantity), Number(custody.returned_quantity), custody.status], [2, 0, "open"]);
  console.log("PASS custody assignment keeps total equipment quantity and creates an open custody");

  await assert.rejects(
    createInventoryMovement(
      { kind: "damage", itemType: "equipment", equipmentId, quantity: 2, reason: "تلف داخل العهدة", damageDate: "2099-02-02" },
      context(),
    ),
    (error: unknown) => assertMovementError(error, "INSUFFICIENT_EQUIPMENT_AVAILABLE"),
  );
  const [afterRejectedDamage] = await sql`SELECT quantity FROM equipment WHERE id = ${equipmentId}`;
  assert.equal(Number(afterRejectedDamage.quantity), 3);
  console.log("PASS damage cannot consume units held in an open custody and leaves balance unchanged");

  await createInventoryMovement(
    { kind: "custody_return", custodyId, quantity: 1, returnCondition: "good", returnedToLocation: "مستودع الاختبار", documentDate: "2099-02-03" },
    context(),
  );
  const [afterPartialReturn] = await sql`
    SELECT quantity, returned_quantity, status FROM personal_custodies WHERE id = ${custodyId}
  `;
  const [equipmentAfterPartial] = await sql`SELECT quantity FROM equipment WHERE id = ${equipmentId}`;
  assert.deepEqual([Number(afterPartialReturn.quantity), Number(afterPartialReturn.returned_quantity), afterPartialReturn.status], [2, 1, "partially_returned"]);
  assert.equal(Number(equipmentAfterPartial.quantity), 3);
  console.log("PASS partial good return reduces open custody without reducing equipment total");

  await createInventoryMovement(
    { kind: "custody_return", custodyId, quantity: 1, returnCondition: "damaged", returnedToLocation: "قسم الفحص", documentDate: "2099-02-04" },
    context(),
  );
  const [afterDamagedReturn] = await sql`
    SELECT returned_quantity, status FROM personal_custodies WHERE id = ${custodyId}
  `;
  const [equipmentAfterDamaged] = await sql`SELECT quantity FROM equipment WHERE id = ${equipmentId}`;
  assert.deepEqual([Number(afterDamagedReturn.returned_quantity), afterDamagedReturn.status], [2, "damaged"]);
  assert.equal(Number(equipmentAfterDamaged.quantity), 2);
  console.log("PASS damaged final return closes custody and reduces operational equipment quantity");

  await assert.rejects(
    createInventoryMovement(
      { kind: "custody_return", custodyId, quantity: 1, returnCondition: "good", returnedToLocation: "مستودع الاختبار", documentDate: "2099-02-05" },
      context(),
    ),
    (error: unknown) => assertMovementError(error, "CUSTODY_RETURN_EXCEEDS_BALANCE"),
  );
  console.log("PASS closed custody rejects an additional return");

  await createInventoryMovement(
    { kind: "central_return", itemType: "equipment", equipmentId, quantity: 1, returnCondition: "good", reason: "إعادة إلى المركز", documentDate: "2099-02-06", notes: "اختبار مستقل عن إعادة العهدة" },
    context(),
  );
  const [afterCentralReturn] = await sql`SELECT quantity FROM equipment WHERE id = ${equipmentId}`;
  assert.equal(Number(afterCentralReturn.quantity), 1);
  const [centralReturnCount] = await sql`SELECT count(*)::int AS count FROM central_returns WHERE created_by = ${userId}`;
  assert.equal(Number(centralReturnCount.count), 1);
  console.log("PASS central return is recorded separately and reduces available equipment quantity");

  await assert.rejects(
    createInventoryMovement(
      { kind: "custody_out", itemType: "equipment", equipmentId: serialEquipmentId, quantity: 2, holderName: "اختبار", custodyNoteNumber: `PHASE5-SERIAL-${suffix}`, custodyDate: "2099-02-07", custodyLocation: "موقع الاختبار" },
      context(),
    ),
    (error: unknown) => assertMovementError(error, "SERIAL_EQUIPMENT_QUANTITY_INVALID"),
  );
  const [serialAfterReject] = await sql`SELECT quantity FROM equipment WHERE id = ${serialEquipmentId}`;
  assert.equal(Number(serialAfterReject.quantity), 1);
  console.log("PASS serial equipment is restricted to one unit per custody movement");

  console.log("Phase 5 asset lifecycle tests passed (7 scenarios).");
} finally {
  await cleanup();
  await sql.end({ timeout: 5 });
}