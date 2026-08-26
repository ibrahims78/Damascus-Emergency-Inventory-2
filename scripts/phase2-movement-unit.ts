import assert from "node:assert/strict";
import {
  allocateBatchesFefo,
  assertEntityReference,
  assertIsoDate,
  assertPositiveInteger,
  InventoryMovementError,
} from "../artifacts/api-server/src/lib/inventory-movement-core";

function expectMovementError(
  name: string,
  operation: () => unknown,
  code: string,
) {
  assert.throws(operation, (error: unknown) => {
    assert.ok(error instanceof InventoryMovementError, `${name}: wrong error type`);
    assert.equal(error.code, code, `${name}: wrong error code`);
    return true;
  });
  console.log(`PASS ${name}`);
}

const allocations = allocateBatchesFefo(
  [
    { id: 1, remainingQuantity: 4, expiryDate: "2026-01-01", batchNumber: "expired" },
    { id: 2, remainingQuantity: 3, expiryDate: "2026-09-01", batchNumber: "soon" },
    { id: 3, remainingQuantity: 10, expiryDate: "2026-12-01", batchNumber: "later" },
    { id: 4, remainingQuantity: 20, expiryDate: null, batchNumber: "no-expiry" },
  ],
  7,
  "2026-08-15",
);
assert.deepEqual(
  allocations.map((allocation) => [allocation.batchId, allocation.quantity]),
  [
    [2, 3],
    [3, 4],
  ],
  "FEFO must skip expired stock and consume the nearest valid expiry first",
);
console.log("PASS FEFO nearest expiry and expired-batch exclusion");

const partialAllocations = allocateBatchesFefo(
  [
    { id: 10, remainingQuantity: 2, expiryDate: "2026-10-01", batchNumber: null },
    { id: 11, remainingQuantity: 5, expiryDate: null, batchNumber: "open" },
  ],
  5,
  "2026-08-15",
);
assert.deepEqual(
  partialAllocations.map((allocation) => allocation.quantity),
  [2, 3],
);
console.log("PASS FEFO partial consumption and no-expiry fallback");

expectMovementError(
  "insufficient FEFO balance",
  () =>
    allocateBatchesFefo(
      [{ id: 20, remainingQuantity: 2, expiryDate: "2026-10-01", batchNumber: null }],
      3,
      "2026-08-15",
    ),
  "INSUFFICIENT_BATCH_STOCK",
);
expectMovementError(
  "entity type mismatch",
  () => assertEntityReference("item", 1, 2),
  "ENTITY_TYPE_MISMATCH",
);
expectMovementError(
  "invalid calendar date",
  () => assertIsoDate("2026-02-30", "اختبار", true),
  "INVALID_DATE",
);
expectMovementError(
  "malformed quantity is not partially parsed",
  () => assertPositiveInteger("2abc", "الكمية"),
  "INVALID_QUANTITY",
);
expectMovementError(
  "malformed entity id is not partially parsed",
  () => assertEntityReference("item", "12x", null),
  "ENTITY_TYPE_MISMATCH",
);

console.log("Phase 2 movement unit tests passed (7 cases).");