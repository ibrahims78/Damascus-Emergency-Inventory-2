import assert from "node:assert/strict";
import postgres from "postgres";
import { createInventoryMovement } from "../artifacts/api-server/src/lib/inventory-movement-service";
import { getItemHistory } from "../artifacts/api-server/src/lib/item-history-service";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the phase-six item history test");
}

const sql = postgres(process.env.DATABASE_URL);
const suffix = `${Date.now()}`;
let userId = 0;
let itemId = 0;
let otherItemId = 0;
let recipientId = 0;
let exitReasonId = 0;

const context = () => ({
  userId,
  userName: "Phase 6 item history test",
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
    if (otherItemId) await tx`DELETE FROM items WHERE id = ${otherItemId}`;
    await tx`DELETE FROM users WHERE id = ${userId}`;
  });
}

try {
  const [user] = await sql`
    INSERT INTO users (username, password_hash, full_name, role, is_active)
    VALUES (${`__phase6_history_${suffix}`}, 'phase6-smoke-no-login', 'Phase 6 history test', 'admin', true)
    RETURNING id
  `;
  userId = Number(user.id);

  const [item] = await sql`
    INSERT INTO items (name, item_type, unit, current_stock, min_stock, location)
    VALUES (${`__phase6_item_${suffix}`}, 'item', 'علبة', 0, 2, 'رف A-6')
    RETURNING id
  `;
  itemId = Number(item.id);
  const [otherItem] = await sql`
    INSERT INTO items (name, item_type, unit, current_stock, min_stock)
    VALUES (${`__phase6_other_${suffix}`}, 'item', 'علبة', 0, 0)
    RETURNING id
  `;
  otherItemId = Number(otherItem.id);
  const [recipient] = await sql`
    INSERT INTO recipients (name, is_active)
    VALUES (${`__phase6_recipient_${suffix}`}, true)
    RETURNING id
  `;
  recipientId = Number(recipient.id);
  const [reason] = await sql`
    INSERT INTO exit_reasons (name, is_active)
    VALUES (${`__phase6_reason_${suffix}`}, true)
    RETURNING id
  `;
  exitReasonId = Number(reason.id);

  await createInventoryMovement(
    {
      kind: "in",
      itemType: "item",
      itemId,
      quantity: 5,
      deliveryNoteNumber: `PHASE6-IN-${suffix}-EARLY`,
      deliveryNoteDate: "2099-01-02",
      documentDate: "2099-01-02",
      batchNumber: "HISTORY-EARLY",
      expiryDate: "2099-12-31",
    },
    context(),
  );
  await createInventoryMovement(
    {
      kind: "in",
      itemType: "item",
      itemId,
      quantity: 3,
      deliveryNoteNumber: `PHASE6-IN-${suffix}-LATE`,
      deliveryNoteDate: "2099-01-04",
      documentDate: "2099-01-04",
      batchNumber: "HISTORY-LATE",
      expiryDate: "2100-01-01",
    },
    context(),
  );
  await createInventoryMovement(
    {
      kind: "out",
      itemType: "item",
      itemId,
      quantity: 2,
      recipientId,
      exitReasonId,
      internalDeliveryNoteNumber: `PHASE6-OUT-${suffix}`,
      internalDeliveryNoteDate: "2099-01-05",
      documentDate: "2099-01-05",
      deliveryDestination: "ambulance_point",
    },
    context(),
  );
  await createInventoryMovement(
    {
      kind: "in",
      itemType: "item",
      itemId: otherItemId,
      quantity: 9,
      deliveryNoteNumber: `PHASE6-OTHER-${suffix}`,
      deliveryNoteDate: "2099-01-03",
      documentDate: "2099-01-03",
      batchNumber: "OTHER-ONLY",
    },
    context(),
  );

  const [legacy] = await sql`
    INSERT INTO transactions (type, item_type, item_id, quantity, document_number, document_date, is_historical_incomplete, created_by)
    VALUES ('init', 'item', ${itemId}, NULL, ${`PHASE6-LEGACY-${suffix}`}, NULL, true, ${userId})
    RETURNING id
  `;
  assert.ok(legacy.id);

  const firstPage = await getItemHistory(itemId, { page: 1, limit: 2 });
  assert.ok(firstPage);
  assert.equal(firstPage.total, 4);
  assert.equal(firstPage.page, 1);
  assert.equal(firstPage.movements.length, 2);
  assert.equal(firstPage.movements[0].documentDate, "2099-01-02");
  assert.equal(firstPage.movements[1].documentDate, "2099-01-04");
  console.log("PASS item history is chronological and paginated");

  const secondPage = await getItemHistory(itemId, { page: 2, limit: 2 });
  assert.ok(secondPage);
  assert.equal(secondPage.movements.length, 2);
  assert.equal(secondPage.movements[0].documentDate, "2099-01-05");
  assert.equal(secondPage.movements[1].isHistoricalIncomplete, true);
  assert.equal(secondPage.movements[1].quantity, null);
  console.log("PASS historical incomplete rows remain visible with nullable fields");

  const filtered = await getItemHistory(itemId, {
    type: "in",
    from: "2099-01-03",
    to: "2099-01-04",
    document: "IN-",
  });
  assert.ok(filtered);
  assert.equal(filtered.total, 1);
  assert.equal(filtered.movements[0].batchNumber, "HISTORY-LATE");
  console.log("PASS type, date, and document filters compose correctly");

  assert.equal(firstPage.movements.some((movement) => movement.itemId === otherItemId), false);
  assert.equal(firstPage.item.id, itemId);
  assert.equal(firstPage.batches.every((batch) => batch.batchNumber !== "OTHER-ONLY"), true);
  console.log("PASS item history never leaks another item's movement or batch");

  console.log("Phase 6 item history tests passed (4 scenarios).");
} finally {
  await cleanup();
  await sql.end({ timeout: 5 });
}