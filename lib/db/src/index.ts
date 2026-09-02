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
  if (coreSchemaReady) {
    // Additive migration for existing desktop databases (approved plan §2.1):
    // equipment inventory adjustment snapshot column. Kept idempotent so
    // every boot is safe on both fresh and existing data directories.
    await desktopClient.exec(
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS details jsonb;`,
    );
    // Sync schema drift repairs: desktop-schema.sql historically lacked the
    // severity column and the trusted-nodes/pairings/relay tables. Fresh
    // databases get them from the schema file; existing data directories
    // are repaired here, idempotently, on every boot.
    await desktopClient.exec(
      `ALTER TABLE sync_conflicts ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'medium';`,
    );
    // Transactions sync columns + index + FKs: the packaged desktop-schema.sql
    // historically placed these ALTERs before CREATE TABLE transactions, so
    // fresh databases silently missed them (restore failure "column ... does
    // not exist"). Repair idempotently on every boot for existing machines.
    await desktopClient.exec(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS operation_id text;`);
    await desktopClient.exec(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS origin_node_id text;`);
    await desktopClient.exec(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS origin_sequence integer;`);
    await desktopClient.exec(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS document_number_scope text;`);
    await desktopClient.exec(`CREATE UNIQUE INDEX IF NOT EXISTS transactions_operation_id_unique ON "transactions" ("operation_id");`);
    await desktopClient.exec(`DO $fix$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_item_id_items_id_fk') THEN ALTER TABLE transactions ADD CONSTRAINT transactions_item_id_items_id_fk FOREIGN KEY (item_id) REFERENCES items(id); END IF; END $fix$;`);
    await desktopClient.exec(`DO $fix$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_equipment_id_equipment_id_fk') THEN ALTER TABLE transactions ADD CONSTRAINT transactions_equipment_id_equipment_id_fk FOREIGN KEY (equipment_id) REFERENCES equipment(id); END IF; END $fix$;`);
    await desktopClient.exec(`DO $fix$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_recipient_id_recipients_id_fk') THEN ALTER TABLE transactions ADD CONSTRAINT transactions_recipient_id_recipients_id_fk FOREIGN KEY (recipient_id) REFERENCES recipients(id); END IF; END $fix$;`);
    await desktopClient.exec(`DO $fix$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_exit_reason_id_exit_reasons_id_fk') THEN ALTER TABLE transactions ADD CONSTRAINT transactions_exit_reason_id_exit_reasons_id_fk FOREIGN KEY (exit_reason_id) REFERENCES exit_reasons(id); END IF; END $fix$;`);
    await desktopClient.exec(`DO $fix$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_created_by_users_id_fk') THEN ALTER TABLE transactions ADD CONSTRAINT transactions_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES users(id); END IF; END $fix$;`);
    await desktopClient.exec(
      `CREATE TABLE IF NOT EXISTS sync_trusted_nodes ("node_id" text PRIMARY KEY NOT NULL, "node_type" text NOT NULL, "label" text, "status" text DEFAULT 'trusted' NOT NULL, "paired_at" timestamp with time zone DEFAULT now() NOT NULL, "revoked_at" timestamp with time zone, "last_seen_at" timestamp with time zone);`,
    );
    await desktopClient.exec(
      `CREATE TABLE IF NOT EXISTS sync_pairings ("pairing_id" text PRIMARY KEY NOT NULL, "code_hash" text NOT NULL UNIQUE, "source_node_id" text NOT NULL, "target_node_id" text, "expires_at" timestamp with time zone NOT NULL, "consumed_at" timestamp with time zone, "revoked_at" timestamp with time zone, "created_at" timestamp with time zone DEFAULT now() NOT NULL);`,
    );
    await desktopClient.exec(
      `CREATE TABLE IF NOT EXISTS sync_relay_packages ("relay_id" text PRIMARY KEY NOT NULL, "session_id" text NOT NULL, "package_id" text NOT NULL, "response_to_relay_id" text, "direction" text NOT NULL, "source_node_id" text NOT NULL, "target_node_id" text NOT NULL, "content_hash" text NOT NULL, "transport_hash" text NOT NULL, "payload" text NOT NULL, "status" text DEFAULT 'available' NOT NULL, "expires_at" timestamp with time zone NOT NULL, "downloaded_at" timestamp with time zone, "created_at" timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT "sync_relay_session_transport_unique" UNIQUE("session_id", "transport_hash"));`,
    );
    // Security hardening additions (2026-08): must-change-password flag,
    // Ed25519 sync signing keys, and the persistent rate-limit table.
    await desktopClient.exec(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;`,
    );
    await desktopClient.exec(
      `ALTER TABLE node_identity ADD COLUMN IF NOT EXISTS signing_public_key text;`,
    );
    await desktopClient.exec(
      `ALTER TABLE node_identity ADD COLUMN IF NOT EXISTS signing_private_key text;`,
    );
    await desktopClient.exec(
      `ALTER TABLE sync_trusted_nodes ADD COLUMN IF NOT EXISTS signing_public_key text;`,
    );
    await desktopClient.exec(
      `CREATE TABLE IF NOT EXISTS auth_rate_limits ("key" text PRIMARY KEY NOT NULL, "attempts" integer DEFAULT 0 NOT NULL, "reset_at" timestamp with time zone NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL);`,
    );
    await desktopClient.exec(
      `CREATE TABLE IF NOT EXISTS license_state ("id" serial PRIMARY KEY NOT NULL, "device_id" text NOT NULL, "license" text, "activated_at" timestamp with time zone);`,
    );
    if (backupSchemaReady) {
      return;
    }
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
