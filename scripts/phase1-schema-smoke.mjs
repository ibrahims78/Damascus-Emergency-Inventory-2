import assert from "node:assert/strict";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the phase-one schema smoke test");
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function expectRejected(name, operation) {
  let rejected = false;

  try {
    await sql.begin(async (tx) => {
      await operation(tx);
    });
  } catch {
    rejected = true;
  }

  assert.equal(rejected, true, `${name}: expected the database constraint to reject the operation`);
  console.log(`PASS ${name}`);
}

async function createItem(tx) {
  const [item] = await tx`
    INSERT INTO items (name, item_type, unit, current_stock, min_stock)
    VALUES ('__phase1_schema_smoke_item__', 'item', 'unit', 0, 0)
    RETURNING id
  `;
  return item.id;
}

async function createEquipment(tx) {
  const [equipment] = await tx`
    INSERT INTO equipment (name, condition, quantity, min_quantity)
    VALUES ('__phase1_schema_smoke_equipment__', 'good', 1, 0)
    RETURNING id
  `;
  return equipment.id;
}

try {
  await expectRejected("negative batch quantity", async (tx) => {
    const itemId = await createItem(tx);
    await tx`
      INSERT INTO inventory_batches
        (item_id, received_quantity, remaining_quantity)
      VALUES (${itemId}, -1, -1)
    `;
  });

  await expectRejected("remaining batch quantity above receipt", async (tx) => {
    const itemId = await createItem(tx);
    await tx`
      INSERT INTO inventory_batches
        (item_id, received_quantity, remaining_quantity)
      VALUES (${itemId}, 10, 11)
    `;
  });

  await expectRejected("non-central supply source", async (tx) => {
    const itemId = await createItem(tx);
    await tx`
      INSERT INTO transactions
        (type, item_type, item_id, quantity, document_number, supply_source)
      VALUES ('in', 'item', ${itemId}, 1, '__phase1-invalid-source__', 'private_supplier')
    `;
  });

  await expectRejected("invalid calendar date", async (tx) => {
    const itemId = await createItem(tx);
    await tx`
      INSERT INTO transactions
        (type, item_type, item_id, quantity, document_number, document_date)
      VALUES ('in', 'item', ${itemId}, 1, '__phase1-invalid-date__', '2026-02-30')
    `;
  });

  await expectRejected("duplicate transaction document number", async (tx) => {
    const itemId = await createItem(tx);
    await tx`
      INSERT INTO transactions
        (type, item_type, item_id, quantity, document_number)
      VALUES ('in', 'item', ${itemId}, 1, '__phase1-duplicate-document__')
    `;
    await tx`
      INSERT INTO transactions
        (type, item_type, item_id, quantity, document_number)
      VALUES ('in', 'item', ${itemId}, 1, '__phase1-duplicate-document__')
    `;
  });

  await expectRejected("returned custody quantity above custody quantity", async (tx) => {
    const equipmentId = await createEquipment(tx);
    await tx`
      INSERT INTO personal_custodies
        (equipment_id, holder_name_snap, delivery_note_number, delivery_date,
         quantity, returned_quantity, location)
      VALUES (${equipmentId}, 'Smoke Test Holder', '__phase1-custody__',
              '2026-08-15', 1, 2, 'Smoke Test Location')
    `;
  });

  await expectRejected("entity reference mismatch", async (tx) => {
    const itemId = await createItem(tx);
    const equipmentId = await createEquipment(tx);
    const [transaction] = await tx`
      INSERT INTO transactions
        (type, item_type, item_id, quantity, document_number)
      VALUES ('out', 'item', ${itemId}, 1, '__phase1-event-transaction__')
      RETURNING id
    `;
    await tx`
      INSERT INTO central_returns
        (transaction_id, item_type, equipment_id, quantity, return_date,
         document_number, condition, reason)
      VALUES (${transaction.id}, 'item', ${equipmentId}, 1, '2026-08-15',
              '__phase1-invalid-entity__', 'good', 'Smoke test')
    `;
  });

  console.log("Phase 1 schema smoke tests passed.");
} finally {
  await sql.end({ timeout: 5 });
}