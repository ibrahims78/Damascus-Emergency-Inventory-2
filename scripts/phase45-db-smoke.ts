import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import {
  createSyncPackage,
  readSyncPackage,
} from "@workspace/backup-format";
import {
  applyRestore,
  previewRestore,
} from "../artifacts/api-server/src/lib/backup-service.ts";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the phase 4–5 database smoke test");
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const suffix = randomUUID().slice(0, 8);
const categoryId = 900_000 + Math.floor(Math.random() * 50_000);
const categoryName = `__phase45_restore_${suffix}`;
const password = "phase45-db-smoke-password";

try {
  const buffer = createSyncPackage({
    password,
    packageType: "full-backup",
    schemaVersion: "2026.08",
    sourceNodeId: `phase45-db-${suffix}`,
    records: [
      {
        entityType: "categories",
        localId: categoryId,
        data: { id: categoryId, name: categoryName, type: "consumable" },
      },
    ],
  });
  const pkg = readSyncPackage(buffer, password);

  const first = await applyRestore(pkg, "merge");
  assert.equal(first.counts.applied, 1);
  console.log("PASS phase 5 merge applies a valid record");

  const second = await applyRestore(pkg, "merge");
  assert.equal(second.counts.duplicate, 1);
  console.log("PASS phase 5 merge is idempotent for duplicate records");

  const invalidBuffer = createSyncPackage({
    password,
    packageType: "full-backup",
    schemaVersion: "2026.08",
    sourceNodeId: `phase45-db-${suffix}`,
    records: [
      {
        entityType: "items",
        localId: categoryId + 1,
        data: { id: categoryId + 1, name: "رصيد غير صالح", current_stock: -1, min_stock: 0 },
      },
    ],
  });
  const invalidPreview = previewRestore(readSyncPackage(invalidBuffer, password), "merge");
  assert.equal(invalidPreview.counts.rejected, 1);
  console.log("PASS phase 5 negative balance is rejected during preview");
} finally {
  await sql`DELETE FROM categories WHERE id = ${categoryId} OR name = ${categoryName}`;
  await sql.end({ timeout: 5 });
}