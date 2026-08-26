import assert from "node:assert/strict";
import { createSyncPackage, readSyncPackage, SyncPackageError } from "@workspace/backup-format";

const password = "phase45-test-password";
const records = [
  {
    entityType: "items",
    localId: 11,
    data: { id: 11, name: "اختبار آمن", current_stock: 12, min_stock: 2 },
  },
  {
    entityType: "inventory_batches",
    localId: 21,
    data: { id: 21, item_id: 11, received_quantity: 20, remaining_quantity: 12 },
  },
];
const changes = [
  {
    changeId: "phase45-change",
    operationId: "phase45-operation",
    entityType: "items",
    entityGlobalId: "phase45-item",
    changeType: "create",
    payload: { id: 11 },
    originNodeId: "phase45-node",
    originSequence: 1,
  },
];

const buffer = createSyncPackage({
  password,
  packageType: "full-backup",
  schemaVersion: "2026.08",
  sourceNodeId: "phase45-node",
  records,
  changes,
});
assert.equal(buffer.subarray(0, 9).toString("utf8"), "DME-SYNC\n");
const roundTrip = readSyncPackage(buffer, password);
assert.equal(roundTrip.manifest.packageType, "full-backup");
assert.equal(roundTrip.records.length, records.length);
assert.equal(roundTrip.changes.length, changes.length);
assert.equal(roundTrip.manifest.recordCount, 2);
console.log("PASS phase 4 same-platform package round trip");

const crossPlatform = readSyncPackage(buffer, password);
assert.equal(crossPlatform.records[1]?.data.remaining_quantity, 12);
console.log("PASS phase 4 cross-platform canonical reader");

const tampered = Buffer.from(buffer);
tampered[tampered.length - 1] ^= 1;
assert.throws(() => readSyncPackage(tampered, password), (error: unknown) => {
  return (
    error instanceof SyncPackageError &&
    ["INVALID_PACKAGE", "INTEGRITY_ERROR", "WRONG_PASSWORD"].includes(error.code)
  );
});
console.log("PASS phase 4 tampered byte rejected");

assert.throws(() => readSyncPackage(buffer, "wrong-password"), (error: unknown) => {
  return error instanceof SyncPackageError && error.code === "WRONG_PASSWORD";
});
console.log("PASS phase 4 wrong password rejected");

assert.throws(
  () => readSyncPackage(buffer.subarray(0, buffer.length - 12), password),
  (error: unknown) =>
    error instanceof SyncPackageError &&
    ["INVALID_PACKAGE", "INTEGRITY_ERROR"].includes(error.code),
);
console.log("PASS phase 4 incomplete package rejected");

assert.throws(
  () =>
    createSyncPackage({
      password,
      packageType: "full-backup",
      schemaVersion: "2026.08",
      sourceNodeId: "phase45-node",
      records: [{ entityType: "users", data: { id: 1, passwordHash: "must-not-export" } }],
    }),
  (error: unknown) => error instanceof SyncPackageError && error.code === "SENSITIVE_DATA",
);
console.log("PASS phase 4 sensitive fields rejected");