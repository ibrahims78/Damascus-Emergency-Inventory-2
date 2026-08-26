import { Router } from "express";
import {
  db,
  itemsTable,
  equipmentTable,
  transactionsTable,
  categoriesTable,
  usersTable,
  systemSettingsTable,
  personalCustodiesTable,
  inventoryBatchesTable,
  damageRecordsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { eq, and, lte, gte, sql, desc } from "drizzle-orm";

const router = Router();

// GET /api/reports/stock
router.get("/stock", requireAuth, async (_req, res) => {
  try {
    const items = await db
      .select({
        id: itemsTable.id,
        code: itemsTable.code,
        name: itemsTable.name,
        categoryName: categoriesTable.name,
        itemType: itemsTable.itemType,
        unit: itemsTable.unit,
        currentStock: itemsTable.currentStock,
        minStock: itemsTable.minStock,
        expiryDate: itemsTable.expiryDate,
        batchNumber: itemsTable.batchNumber,
        location: itemsTable.location,
        supplier: itemsTable.supplier,
        updatedAt: itemsTable.updatedAt,
      })
      .from(itemsTable)
      .leftJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .where(eq(itemsTable.isActive, true))
      .orderBy(itemsTable.name);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports/movements
router.get("/movements", requireAuth, async (req, res) => {
  try {
    const { from, to, type, recipient, search } = req.query as Record<string, string>;
    const conditions = [];
    if (from) conditions.push(gte(transactionsTable.createdAt, new Date(from)));
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(transactionsTable.createdAt, toDate));
    }
    if (type) conditions.push(eq(transactionsTable.type, type as never));
    if (recipient) conditions.push(sql`${transactionsTable.recipientNameSnap} ILIKE ${`%${recipient}%`}`);
    if (search) {
      const term = `%${search}%`;
      conditions.push(sql`(
        ${transactionsTable.documentNumber} ILIKE ${term}
        OR ${transactionsTable.recipientNameSnap} ILIKE ${term}
        OR ${transactionsTable.recipientPerson} ILIKE ${term}
        OR ${itemsTable.name} ILIKE ${term}
        OR ${equipmentTable.name} ILIKE ${term}
      )`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const transactions = await db
      .select({
        id: transactionsTable.id,
        type: transactionsTable.type,
        itemType: transactionsTable.itemType,
        itemName: itemsTable.name,
        itemUnit: itemsTable.unit,
        equipmentName: equipmentTable.name,
        quantity: transactionsTable.quantity,
        recipientName: transactionsTable.recipientNameSnap,
        recipientPerson: transactionsTable.recipientPerson,
        exitReason: transactionsTable.exitReasonSnap,
        documentNumber: transactionsTable.documentNumber,
        notes: transactionsTable.notes,
        createdByName: usersTable.fullName,
        createdAt: transactionsTable.createdAt,
      })
      .from(transactionsTable)
      .leftJoin(itemsTable, eq(transactionsTable.itemId, itemsTable.id))
      .leftJoin(equipmentTable, eq(transactionsTable.equipmentId, equipmentTable.id))
      .leftJoin(usersTable, eq(transactionsTable.createdBy, usersTable.id))
      .where(where)
      .orderBy(desc(transactionsTable.createdAt));
    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports/stock-position — reconciled position by ownership/state.
// Damage for consumables is represented by a movement that already reduced
// available stock; equipment damage is represented by its current condition and
// the cumulative damage ledger is returned separately for auditability.
router.get("/stock-position", requireAuth, async (_req, res) => {
  try {
    const [items, equipment, batches, custodyByEquipment, damageByItem, damageByEquipment] =
      await Promise.all([
        db
          .select({
            id: itemsTable.id,
            code: itemsTable.code,
            name: itemsTable.name,
            unit: itemsTable.unit,
            itemType: itemsTable.itemType,
            currentStock: itemsTable.currentStock,
          })
          .from(itemsTable)
          .where(eq(itemsTable.isActive, true))
          .orderBy(itemsTable.name),
        db
          .select({
            id: equipmentTable.id,
            name: equipmentTable.name,
            serialNumber: equipmentTable.serialNumber,
            condition: equipmentTable.condition,
            quantity: equipmentTable.quantity,
            currentHolder: equipmentTable.currentHolder,
          })
          .from(equipmentTable)
          .orderBy(equipmentTable.name),
        db
          .select({
            id: inventoryBatchesTable.id,
            itemId: inventoryBatchesTable.itemId,
            batchNumber: inventoryBatchesTable.batchNumber,
            expiryDate: inventoryBatchesTable.expiryDate,
            remainingQuantity: inventoryBatchesTable.remainingQuantity,
          })
          .from(inventoryBatchesTable)
          .where(sql`${inventoryBatchesTable.remainingQuantity} > 0`)
          .orderBy(sql`${inventoryBatchesTable.expiryDate} ASC NULLS LAST`, inventoryBatchesTable.id),
        db
          .select({
            equipmentId: personalCustodiesTable.equipmentId,
            quantity: sql<number>`coalesce(sum(${personalCustodiesTable.quantity} - ${personalCustodiesTable.returnedQuantity}), 0)`,
          })
          .from(personalCustodiesTable)
          .where(sql`${personalCustodiesTable.status} IN ('open', 'partially_returned', 'damaged')`)
          .groupBy(personalCustodiesTable.equipmentId),
        db
          .select({
            itemId: damageRecordsTable.itemId,
            quantity: sql<number>`coalesce(sum(${damageRecordsTable.quantity}), 0)`,
          })
          .from(damageRecordsTable)
          .where(eq(damageRecordsTable.itemType, "item"))
          .groupBy(damageRecordsTable.itemId),
        db
          .select({
            equipmentId: damageRecordsTable.equipmentId,
            quantity: sql<number>`coalesce(sum(${damageRecordsTable.quantity}), 0)`,
          })
          .from(damageRecordsTable)
          .where(eq(damageRecordsTable.itemType, "equipment"))
          .groupBy(damageRecordsTable.equipmentId),
      ]);

    const custodyMap = new Map(custodyByEquipment.map((row) => [row.equipmentId, Number(row.quantity)]));
    const itemDamageMap = new Map(damageByItem.map((row) => [row.itemId, Number(row.quantity)]));
    const equipmentDamageMap = new Map(
      damageByEquipment.map((row) => [row.equipmentId, Number(row.quantity)]),
    );
    const batchesByItem = new Map<number, typeof batches>();
    for (const batch of batches) {
      const current = batchesByItem.get(batch.itemId) ?? [];
      current.push(batch);
      batchesByItem.set(batch.itemId, current);
    }

    res.json({
      generatedAt: new Date().toISOString(),
      items: items.map((item) => ({
        ...item,
        availableQuantity: item.currentStock,
        custodyQuantity: 0,
        damagedQuantity: itemDamageMap.get(item.id) ?? 0,
        batches: (batchesByItem.get(item.id) ?? []).map((batch) => ({
          ...batch,
          remainingQuantity: Number(batch.remainingQuantity),
        })),
      })),
      equipment: equipment.map((item) => {
        const custodyQuantity = custodyMap.get(item.id) ?? 0;
        return {
          ...item,
          quantity: Number(item.quantity ?? 0),
          availableQuantity: Math.max(0, Number(item.quantity ?? 0) - custodyQuantity),
          custodyQuantity,
          damagedQuantity:
            item.condition === "broken" || item.condition === "consumed"
              ? Number(item.quantity ?? 0)
              : 0,
          damagedLedgerQuantity: equipmentDamageMap.get(item.id) ?? 0,
        };
      }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports/custodies — open, partially returned, and age-overdue custody.
router.get("/custodies", requireAuth, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const overdueDaysRaw = Number.parseInt(String(req.query.overdueDays ?? "30"), 10);
    const overdueDays = Number.isSafeInteger(overdueDaysRaw)
      ? Math.min(3650, Math.max(1, overdueDaysRaw))
      : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - overdueDays);
    const conditions = [
      sql`${personalCustodiesTable.status} IN ('open', 'partially_returned', 'damaged')`,
    ];
    if (status) conditions.push(eq(personalCustodiesTable.status, status as never));
    if (search) {
      const term = `%${search}%`;
      conditions.push(sql`(
        ${personalCustodiesTable.holderNameSnap} ILIKE ${term}
        OR ${personalCustodiesTable.deliveryNoteNumber} ILIKE ${term}
        OR ${equipmentTable.name} ILIKE ${term}
        OR ${equipmentTable.serialNumber} ILIKE ${term}
      )`);
    }

    const rows = await db
      .select({
        id: personalCustodiesTable.id,
        equipmentId: personalCustodiesTable.equipmentId,
        equipmentName: equipmentTable.name,
        serialNumber: equipmentTable.serialNumber,
        holderName: personalCustodiesTable.holderNameSnap,
        quantity: personalCustodiesTable.quantity,
        returnedQuantity: personalCustodiesTable.returnedQuantity,
        outstandingQuantity: sql<number>`${personalCustodiesTable.quantity} - ${personalCustodiesTable.returnedQuantity}`,
        deliveryNoteNumber: personalCustodiesTable.deliveryNoteNumber,
        deliveryDate: personalCustodiesTable.deliveryDate,
        location: personalCustodiesTable.location,
        status: personalCustodiesTable.status,
        overdue: sql<boolean>`${personalCustodiesTable.deliveryDate} < ${cutoff.toISOString().slice(0, 10)}`,
      })
      .from(personalCustodiesTable)
      .innerJoin(equipmentTable, eq(personalCustodiesTable.equipmentId, equipmentTable.id))
      .where(and(...conditions))
      .orderBy(desc(personalCustodiesTable.deliveryDate), desc(personalCustodiesTable.id));

    res.json({
      overdueDays,
      generatedAt: new Date().toISOString(),
      records: rows.map((row) => ({
        ...row,
        quantity: Number(row.quantity),
        returnedQuantity: Number(row.returnedQuantity),
        outstandingQuantity: Number(row.outstandingQuantity),
      })),
      totals: {
        open: rows.filter((row) => row.status === "open").length,
        partial: rows.filter((row) => row.status === "partially_returned").length,
        overdue: rows.filter((row) => row.overdue).length,
        outstandingQuantity: rows.reduce((sum, row) => sum + Number(row.outstandingQuantity), 0),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports/expiry
router.get("/expiry", requireAuth, async (_req, res) => {
  try {
    const settings = await db.query.systemSettingsTable.findFirst();
    const alertDays = settings?.expiryAlertDays ?? 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + alertDays);

    const items = await db
      .select({
        id: itemsTable.id,
        code: itemsTable.code,
        name: itemsTable.name,
        categoryName: categoriesTable.name,
        unit: itemsTable.unit,
        currentStock: itemsTable.currentStock,
        expiryDate: itemsTable.expiryDate,
        batchNumber: itemsTable.batchNumber,
        location: itemsTable.location,
        supplier: itemsTable.supplier,
      })
      .from(itemsTable)
      .leftJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .where(
        and(
          eq(itemsTable.isActive, true),
          sql`${itemsTable.expiryDate} IS NOT NULL AND ${itemsTable.expiryDate} <= ${cutoffDate.toISOString().split("T")[0]}`
        )
      )
      .orderBy(itemsTable.expiryDate);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports/below-min
router.get("/below-min", requireAuth, async (_req, res) => {
  try {
    const items = await db
      .select({
        id: itemsTable.id,
        code: itemsTable.code,
        name: itemsTable.name,
        categoryName: categoriesTable.name,
        itemType: itemsTable.itemType,
        unit: itemsTable.unit,
        currentStock: itemsTable.currentStock,
        minStock: itemsTable.minStock,
        location: itemsTable.location,
        supplier: itemsTable.supplier,
      })
      .from(itemsTable)
      .leftJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .where(
        and(
          eq(itemsTable.isActive, true),
          lte(itemsTable.currentStock, itemsTable.minStock)
        )
      )
      .orderBy(itemsTable.currentStock);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports/equipment
router.get("/equipment", requireAuth, async (_req, res) => {
  try {
    const equipment = await db.query.equipmentTable.findMany({
      orderBy: (e, { asc }) => [asc(e.name)],
    });
    res.json(equipment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
