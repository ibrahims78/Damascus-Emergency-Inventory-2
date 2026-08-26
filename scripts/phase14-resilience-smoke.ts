import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createSyncPackage, readSyncPackage } from "../lib/backup-format/src/index.ts";

const password = "phase14-resilience-password";
const records = Array.from({ length: 100_000 }, (_, index) => ({
  entityType: "items",
  globalId: `phase14-item-${index}`,
  data: { name: `fixture-${index}`, quantity: index % 37, unit: "piece" },
}));
const changes = Array.from({ length: 10_000 }, (_, index) => ({
  changeId: randomUUID(),
  operationId: randomUUID(),
  entityType: "items",
  entityGlobalId: `phase14-item-${index % 100_000}`,
  changeType: "update",
  payload: { quantity: index % 37 },
  originNodeId: "phase14-node",
  originSequence: index + 1,
}));
const buffer = createSyncPackage({
  password,
  packageType: "full-backup",
  schemaVersion: "2026.08",
  sourceNodeId: "phase14-node",
  records,
  changes,
});
assert.ok(buffer.length > 0);
const roundTrip = readSyncPackage(buffer, password);
assert.equal(roundTrip.records.length, 100_000);
assert.equal(roundTrip.changes.length, 10_000);
console.log("PASS phase 14 100,000-record backup and 10,000-change round trip");

const tampered = Buffer.from(buffer);
tampered[tampered.length - 1] ^= 1;
assert.throws(() => readSyncPackage(tampered, password));
assert.throws(() => readSyncPackage(buffer, "wrong-phase14-password"));
console.log("PASS phase 14 tamper and wrong-password recovery gates reject without data application");