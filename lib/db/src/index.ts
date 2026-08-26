import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const isDesktopMode = process.env.DAMASCUS_DESKTOP === "1";
export const desktopMode = isDesktopMode;

if (!isDesktopMode && !process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const postgresPool = isDesktopMode
  ? null
  : new Pool({ connectionString: process.env.DATABASE_URL });

const desktopDataDir = resolve(
  process.env.DAMASCUS_DATA_DIR || ".damascus-desktop-data",
);
const desktopClient = isDesktopMode ? new PGlite(desktopDataDir) : null;

/**
 * The API keeps its existing PostgreSQL implementation for Replit and hosted
 * deployments. Desktop builds use the same PostgreSQL dialect through PGlite,
 * which gives Electron a durable local database without requiring users to
 * install PostgreSQL on Windows.
 */
export const pool: any = postgresPool;
// Drizzle is constructed for both modes so TypeScript retains the schema
// inference used throughout the API. The PostgreSQL client is never queried
// when desktop mode is active.
const postgresDb = drizzlePostgres(postgresPool as any, { schema });
type AppDatabase = typeof postgresDb;

export const db: AppDatabase = isDesktopMode
  ? (drizzlePglite(desktopClient!, { schema }) as unknown as AppDatabase)
  : postgresDb!;

async function initializeDesktopDatabase(): Promise<void> {
  if (!desktopClient) return;

  const existing = await desktopClient.query<{
    usersTable: string | null;
    transactionsTable: string | null;
    nodeIdentityTable: string | null;
    backupRestorePointsTable: string | null;
    backupRestorePreviewsTable: string | null;
    backupCatalogTable: string | null;
    backupRetentionPolicyTable: string | null;
  }>(
    `select
       to_regclass('public.users') as "usersTable",
       to_regclass('public.transactions') as "transactionsTable",
       to_regclass('public.node_identity') as "nodeIdentityTable",
       to_regclass('public.backup_restore_points') as "backupRestorePointsTable",
       to_regclass('public.backup_restore_previews') as "backupRestorePreviewsTable",
       to_regclass('public.backup_catalog') as "backupCatalogTable",
       to_regclass('public.backup_retention_policy') as "backupRetentionPolicyTable"`,
  );
  const currentSchema = existing.rows[0];
  const coreSchemaReady = Boolean(
    currentSchema?.usersTable &&
      currentSchema.transactionsTable &&
      currentSchema.nodeIdentityTable,
  );
  const backupSchemaReady = Boolean(
    currentSchema?.backupRestorePointsTable &&
      currentSchema.backupRestorePreviewsTable &&
      currentSchema.backupCatalogTable &&
      currentSchema.backupRetentionPolicyTable,
  );
  if (coreSchemaReady && backupSchemaReady) {
    return;
  }

  const schemaPath = process.env.DAMASCUS_SCHEMA_PATH;
  if (!schemaPath) {
    throw new Error(
      "DAMASCUS_SCHEMA_PATH must point to the bundled desktop database schema.",
    );
  }

  const schemaSql = await readFile(schemaPath, "utf8");
  const statements = schemaSql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  // The desktop schema is generated from the hosted database's additive
  // migrations. A clean PGlite database needs all CREATE TABLE statements
  // before the migration ALTER TABLE statements, and the bundled PGlite
  // seed can already contain a subset of the tables. Keep initialization
  // safe for both cases.
  const createTables = statements.filter((statement) =>
    /^\s*CREATE TABLE\b/i.test(statement),
  );
  const remainingStatements = statements.filter(
    (statement) => !/^\s*CREATE TABLE\b/i.test(statement),
  );
  // Existing desktop installations may already have the core schema but were
  // created before backup previews/rollback points were introduced. In that
  // case, only add the missing backup tables; replaying all foreign-key
  // statements would fail on an otherwise healthy database.
  const statementsToApply =
    coreSchemaReady && !backupSchemaReady
      ? [
          ...createTables.filter((statement) =>
            /\bbackup_(?:restore_points|restore_previews|catalog|retention_policy)\b/i.test(
              statement,
            ),
          ),
          ...remainingStatements.filter((statement) =>
            /backup_restore_previews_expires_idx/i.test(statement),
          ),
        ]
      : [...createTables, ...remainingStatements];

  for (const statement of statementsToApply) {
    const idempotentStatement = statement
      .replace(
        /^\s*CREATE TABLE\s+/i,
        (prefix) => `${prefix}IF NOT EXISTS `,
      )
      .replace(
        /^\s*CREATE UNIQUE INDEX\s+/i,
        (prefix) => `${prefix}IF NOT EXISTS `,
      )
      .replace(
        /^\s*CREATE INDEX\s+/i,
        (prefix) => `${prefix}IF NOT EXISTS `,
      )
      .replace(/\bADD COLUMN\s+"/gi, 'ADD COLUMN IF NOT EXISTS "');

    await desktopClient.exec(idempotentStatement);
  }
}

export const databaseReady = isDesktopMode
  ? initializeDesktopDatabase()
  : Promise.resolve();

export * from "./schema";
