import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  mergeVectors,
  missingSequences,
  validatePortableChange,
  validatePortableNodeIdentity,
} from "../lib/sync-contract/src/index.ts";

const windows = validatePortableNodeIdentity({
  nodeId: `windows-${randomUUID()}`,
  installationId: randomUUID(),
  nodeType: "windows",
  originSequence: 0,
  createdAt: new Date().toISOString(),
});
const android = validatePortableNodeIdentity({
  nodeId: `android-${randomUUID()}`,
  installationId: randomUUID(),
  nodeType: "android",
  originSequence: 0,
  createdAt: new Date().toISOString(),
});
assert.notEqual(windows.nodeId, android.nodeId);
assert.deepEqual(mergeVectors({ [windows.nodeId]: 3 }, { [android.nodeId]: 2 }), {
  [windows.nodeId]: 3,
  [android.nodeId]: 2,
});
assert.deepEqual(missingSequences({ [windows.nodeId]: 1 }, { [windows.nodeId]: 3 }), [
  { nodeId: windows.nodeId, from: 2, to: 3 },
]);
validatePortableChange({
  changeId: randomUUID(),
  operationId: randomUUID(),
  entityType: "items",
  entityGlobalId: randomUUID(),
  originNodeId: windows.nodeId,
  originSequence: 1,
  changeType: "create",
  payload: { name: "fixture" },
  createdAt: new Date().toISOString(),
});
assert.throws(() => validatePortableChange({
  changeId: "",
  operationId: randomUUID(),
  entityType: "items",
  entityGlobalId: randomUUID(),
  originNodeId: windows.nodeId,
  originSequence: 1,
  changeType: "create",
  payload: {},
  createdAt: new Date().toISOString(),
}), /SYNC_CHANGE_IDENTITY_INVALID/);
console.log("PASS phases 10–13 shared contract keeps Windows/Android identities and vectors portable");
console.log("PASS phases 10–13 invalid legacy/change identities are rejected before import");