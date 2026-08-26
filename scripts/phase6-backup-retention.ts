import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import {
  createSyncPackage,
  readSyncPackage,
} from "@workspace/backup-format";
import { categoriesTable, db } from "../lib/db/src/index.ts";
import { eq } from "drizzle-orm";
import {
  applyRestore,
  createDeltaBackup,
  createFullBackup,
  enforceRetentionPolicy,
  getRetentionPolicy,
  storeBackupPackage,
  updateRetentionPolicy,
  verifyCatalogBackup,
} from "../artifacts/api-server/src/lib/backup-service.ts";
import { ensureNodeIdentity, recordLocalChange } from "../artifacts/api-server/src/lib/sync-service.ts";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the phase six backup test");
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const suffix = randomUUID().slice(0, 8);
const password = "phase6-backup-test-password";
const categoryName = `__phase6_backup_${suffix}`;
const storedIds: string[] = [];
let changeId: string | undefined;
let categoryId: number | undefined;

try {
  const node = await ensureNodeIdentity("web");
  const [created] = await db
    .insert(categoriesTable)
    .values({ name: categoryName, type: "consumable" })
    .returning({ id: categoriesTable.id });
  categoryId = created.id;

  const fullBuffer = await createFullBackup(password);
  const fullPackage = readSyncPackage(fullBuffer, password);
  assert.equal(fullPackage.manifest.packageType, "full-backup");
  const fullStored = await storeBackupPackage(fullBuffer, password, { retentionClass: "daily" });
  storedIds.push(fullStored.id);
  assert.equal(fullStored.packageType, "full-backup");
  assert.equal(fullStored.packageHash, fullPackage.packageHash);
  console.log("PASS phase 6 full backup is encrypted and cataloged");

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(categoriesTable)
      .set({ name: `${categoryName}-changed` })
      .where(eq(categoriesTable.id, categoryId!))
      .returning();
    const result = await recordLocalChange(tx, {
      nodeId: node.nodeId,
      entityType: "category",
      localEntityId: categoryId,
      changeType: "update",
      payload: { name: updated.name, type: updated.type },
    });
    changeId = result.changeId;
  });

  const deltaBuffer = await createDeltaBackup(password, fullPackage.manifest.lastVector ?? {});
  const deltaPackage = readSyncPackage(deltaBuffer, password);
  assert.equal(deltaPackage.manifest.packageType, "delta-sync");
  assert.equal(deltaPackage.changes.some((change) => change.changeId === changeId), true);
  assert.equal(deltaPackage.records.some((record) => record.localId === categoryId), true);
  const deltaStored = await storeBackupPackage(deltaBuffer, password, { retentionClass: "daily" });
  storedIds.push(deltaStored.id);
  const deltaReport = await applyRestore(deltaPackage, "merge");
  assert.equal(deltaReport.counts.applied, 1);
  console.log("PASS phase 6 delta contains pending changes and applies after full baseline");

  const verified = await verifyCatalogBackup(fullStored.id, password);
  assert.equal(verified.verified, true);
  console.log("PASS phase 6 catalog fingerprint verification");

  await updateRetentionPolicy({ dailyLimit: 1, weeklyLimit: 1, monthlyLimit: 1 });
  for (let index = 0; index < 2; index += 1) {
    const extra = createSyncPackage({
      password,
      packageType: "full-backup",
      schemaVersion: "2026.08",
      sourceNodeId: `phase6-${suffix}`,
      records: [],
      changes: [],
    });
    const stored = await storeBackupPackage(extra, password, { retentionClass: "daily" });
    storedIds.push(stored.id);
  }
  const retention = await enforceRetentionPolicy();
  assert.ok(retention.deleted.length >= 1);
  assert.ok(retention.kept >= 1);
  console.log("PASS phase 6 retention removes excess copies without removing all full backups");
} finally {
  await sql`DELETE FROM sync_outbox WHERE change_id = ${changeId ?? "__phase6-no-change__"}`;
  await sql`DELETE FROM sync_change_log WHERE change_id = ${changeId ?? "__phase6-no-change__"}`;
  if (categoryId) await sql`DELETE FROM categories WHERE id = ${categoryId}`;
  for (const id of storedIds) await sql`DELETE FROM backup_catalog WHERE id = ${id}`;
  await updateRetentionPolicy({ dailyLimit: 30, weeklyLimit: 12, monthlyLimit: 12 }).catch(() => undefined);
  await sql.end({ timeout: 5 });
}

const policy = await getRetentionPolicy();
assert.equal(policy.dailyLimit, 30);
console.log("Phase 6 backup tests passed (full, delta, verification, retention).");