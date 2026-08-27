import { Router } from "express";
import {
  db,
  inventoryBatchesTable,
  itemsTable,
  categoriesTable,
  systemSettingsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { auditLog } from "../middlewares/audit";
import { runAlertWorker } from "../lib/alert-worker";
import {
  ensureEntityIdentity,
  ensureNodeIdentity,
  recordLocalChange,
} from "../lib/sync-service";
import {
  allocateBatchesFefo,
  InventoryMovementError,
  type FefoBatch,
} from "../lib/inventory-movement-core";
import {
  getItemHistory,
  ITEM_HISTORY_TYPES,
  type ItemHistoryType,
} from "../lib/item-history-service";
import { eq, and, ilike, or, lte, sql, isNotNull, asc, desc, type AnyColumn } from "drizzle-orm";

const router = Router();

// GET /api/items
router.get("/", requireAuth, async (req, res) => {
  try {
    const {
      categoryId,
      search,
      belowMin,
      nearExpiry,
      page = "1",
      limit = "50",
      sortBy = "name",
      sortDir = "asc",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    // Catalog pickers request the complete active catalog in one stable,
    // sorted list. Keep a generous safety cap without silently truncating
    // normal inventory catalogs.
    const limitNum = Math.min(5000, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [eq(itemsTable.isActive, true)];

    if (categoryId) conditions.push(eq(itemsTable.categoryId, parseInt(categoryId, 10)));
    if (search) {
      conditions.push(
        or(
          ilike(itemsTable.name, `%${search}%`),
          ilike(itemsTable.code, `%${search}%`),
          ilike(itemsTable.batchNumber, `%${search}%`),
          ilike(itemsTable.supplier, `%${search}%`)
        )!
      );
    }
    if (belowMin === "true")
      conditions.push(lte(itemsTable.currentStock, itemsTable.minStock));
    if (nearExpiry === "true") {
      const settings = await db.query.systemSettingsTable.findFirst();
      const alertDays = settings?.expiryAlertDays ?? 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + alertDays);
      conditions.push(
        sql`${itemsTable.expiryDate} IS NOT NULL AND ${itemsTable.expiryDate} <= ${cutoffDate.toISOString().split("T")[0]}`
      );
    }

    const where = and(...conditions);

    // Sort
    const allowedSortCols = ["name", "currentStock", "minStock", "expiryDate", "createdAt"] as const;
    type SortCol = (typeof allowedSortCols)[number];
    const col: SortCol = allowedSortCols.includes(sortBy as SortCol) ? (sortBy as SortCol) : "name";
    const direction = sortDir === "desc" ? "desc" : "asc";

    const colMap: Record<SortCol, AnyColumn> = {
      name: itemsTable.name,
      currentStock: itemsTable.currentStock,
      minStock: itemsTable.minStock,
      expiryDate: itemsTable.expiryDate,
      createdAt: itemsTable.createdAt,
    };

    const orderExpr = direction === "asc" ? asc(colMap[col]) : desc(colMap[col]);

    const [items, totalResult] = await Promise.all([
      db
        .select({
          id: itemsTable.id,
          code: itemsTable.code,
          name: itemsTable.name,
          categoryId: itemsTable.categoryId,
          categoryName: categoriesTable.name,
          itemType: itemsTable.itemType,
          unit: itemsTable.unit,
          currentStock: itemsTable.currentStock,
          minStock: itemsTable.minStock,
          expiryDate: itemsTable.expiryDate,
          batchNumber: itemsTable.batchNumber,
          location: itemsTable.location,
          supplier: itemsTable.supplier,
          notes: itemsTable.notes,
          isActive: itemsTable.isActive,
          createdAt: itemsTable.createdAt,
          updatedAt: itemsTable.updatedAt,
        })
        .from(itemsTable)
        .leftJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
        .where(where)
        .orderBy(orderExpr)
        .limit(limitNum)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(itemsTable)
        .where(where),
    ]);

    res.json({
      items,
      total: Number(totalResult[0]?.count ?? 0),
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/items
router.post(
  "/",
  requireAuth,
  requireRole("admin", "warehouse_manager"),
  async (req, res) => {
    try {
      const {
        code,
        name,
        categoryId,
        itemType,
        unit,
        currentStock = 0,
        minStock = 0,
        expiryDate,
        batchNumber,
        location,
        supplier,
        notes,
      } = req.body;
      if (!name || !itemType || !unit) {
        res.status(400).json({ error: "name, itemType, and unit are required" });
        return;
      }
      const parsedStock = parseInt(currentStock, 10);
      const parsedMinStock = parseInt(minStock, 10);
      if (isNaN(parsedStock) || parsedStock < 0) {
        res.status(400).json({ error: "currentStock must be a non-negative number" });
        return;
      }
      if (isNaN(parsedMinStock) || parsedMinStock < 0) {
        res.status(400).json({ error: "minStock must be a non-negative number" });
        return;
      }
      const node = await ensureNodeIdentity("web");
      const item = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(itemsTable)
          .values({
            code: code || null,
            name,
            categoryId: categoryId ? parseInt(categoryId, 10) : null,
            itemType,
            unit,
            currentStock: parsedStock,
            minStock: parsedMinStock,
            expiryDate: expiryDate || null,
            batchNumber: batchNumber || null,
            location: location || null,
            supplier: supplier || null,
            notes: notes || null,
          })
          .returning();
        if (created.currentStock > 0) {
          const openingDate = new Date().toISOString().slice(0, 10);
          await tx.insert(inventoryBatchesTable).values({
            itemId: created.id,
            receivedQuantity: created.currentStock,
            remainingQuantity: created.currentStock,
            deliveryNoteNumber: `افتتاحي-${created.id}`,
            deliveryNoteDate: openingDate,
            supplySource: "central_warehouses",
          });
        }
        const globalId = await ensureEntityIdentity(tx, "item", created.id);
        await recordLocalChange(tx, {
          nodeId: node.nodeId,
          entityType: "item",
          localEntityId: created.id,
          globalId,
          changeType: "create",
          payload: {
            ...created,
            categoryGlobalId: created.categoryId
              ? await ensureEntityIdentity(tx, "category", created.categoryId)
              : null,
          },
        });
        // Opening batch travels as its own change so the receiver restores
        // both the stock balance and its FEFO batch.
        const createdBatches = await tx
          .select()
          .from(inventoryBatchesTable)
          .where(eq(inventoryBatchesTable.itemId, created.id));
        for (const batch of createdBatches) {
          const batchGlobalId = await ensureEntityIdentity(tx, "inventory_batch", batch.id);
          await recordLocalChange(tx, {
            nodeId: node.nodeId,
            entityType: "inventory_batch",
            localEntityId: batch.id,
            globalId: batchGlobalId,
            changeType: "create",
            payload: {
              ...batch,
              itemGlobalId: globalId,
            },
          });
        }
        return created;
      });
      await auditLog({ req, action: "create", entityType: "item", entityId: item.id, details: { name: item.name, itemType: item.itemType } });
      res.status(201).json(item);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/items/bulk-import
router.post(
  "/bulk-import",
  requireAuth,
  requireRole("admin", "warehouse_manager"),
  async (req, res) => {
    try {
      const items = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: "يجب إرسال قائمة مواد صالحة" });
        return;
      }
      if (items.length > 1000) {
        res.status(400).json({ error: "الحد الأقصى للاستيراد 1000 صف في المرة الواحدة" });
        return;
      }

      // Fetch all categories for name→id resolution
      const allCategories = await db
        .select({ id: categoriesTable.id, name: categoriesTable.name })
        .from(categoriesTable);
      const categoryMap = new Map(
        allCategories.map((c) => [c.name.trim().toLowerCase(), c.id])
      );

      const mode = (req.query.mode as string) === "upsert" ? "upsert" : "insert";

      // In upsert mode, pre-fetch existing codes (one query) for insert-vs-update tracking
      const existingCodes = new Set<string>();
      if (mode === "upsert") {
        const existing = await db
          .select({ code: itemsTable.code })
          .from(itemsTable)
          .where(isNotNull(itemsTable.code));
        existing.forEach((r) => { if (r.code) existingCodes.add(r.code); });
      }

      const results: {
        created: number;
        updated: number;
        errors: { row: number; name: string; error: string }[];
      } = { created: 0, updated: 0, errors: [] };

      const bulkNode = await ensureNodeIdentity("web");

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rowNum = i + 2; // Excel row (header = row 1)
        const name = String(item.name ?? "").trim();
        const unit = String(item.unit ?? "").trim();

        if (!name) {
          results.errors.push({ row: rowNum, name: `صف ${rowNum}`, error: "الاسم مطلوب" });
          continue;
        }
        if (!unit) {
          results.errors.push({ row: rowNum, name, error: "الوحدة مطلوبة" });
          continue;
        }

        // Resolve category name → id
        let categoryId: number | null = null;
        if (item.categoryName) {
          const resolved = categoryMap.get(String(item.categoryName).trim().toLowerCase());
          if (resolved !== undefined) categoryId = resolved;
        }

        const currentStock = parseInt(String(item.currentStock ?? 0), 10);
        const minStock = parseInt(String(item.minStock ?? 0), 10);

        if (isNaN(currentStock) || currentStock < 0) {
          results.errors.push({ row: rowNum, name, error: "الكمية الحالية يجب أن تكون رقماً موجباً" });
          continue;
        }
        if (isNaN(minStock) || minStock < 0) {
          results.errors.push({ row: rowNum, name, error: "الحد الأدنى يجب أن يكون رقماً موجباً" });
          continue;
        }

        const code = item.code ? String(item.code).trim() : null;
        const isUpdate = mode === "upsert" && code !== null && existingCodes.has(code);

        const values = {
          code,
          name,
          categoryId,
          itemType: "item" as const,
          unit,
          currentStock,
          minStock,
          expiryDate: item.expiryDate ? String(item.expiryDate).trim() : null,
          batchNumber: item.batchNumber ? String(item.batchNumber).trim() : null,
          location: item.location ? String(item.location).trim() : null,
          supplier: item.supplier ? String(item.supplier).trim() : null,
          notes: item.notes ? String(item.notes).trim() : null,
        };

        try {
          if (mode === "upsert" && code !== null) {
            const [saved] = await db.transaction(async (tx) => {
              const [row] = await tx
                .insert(itemsTable)
                .values(values)
                .onConflictDoUpdate({
                  target: itemsTable.code,
                  set: {
                    name: values.name,
                    categoryId: values.categoryId,
                    unit: values.unit,
                    currentStock: values.currentStock,
                    minStock: values.minStock,
                    expiryDate: values.expiryDate,
                    batchNumber: values.batchNumber,
                    location: values.location,
                    supplier: values.supplier,
                    notes: values.notes,
                  },
                })
                .returning();
              const globalId = await ensureEntityIdentity(tx, "item", row.id);
              await recordLocalChange(tx, {
                nodeId: bulkNode.nodeId,
                entityType: "item",
                localEntityId: row.id,
                globalId,
                changeType: isUpdate ? "update" : "create",
                payload: {
                  ...row,
                  categoryGlobalId: row.categoryId
                    ? await ensureEntityIdentity(tx, "category", row.categoryId)
                    : null,
                },
              });
              return [row];
            });
            if (isUpdate) {
              results.updated++;
              await auditLog({
                req, action: "update", entityType: "item", entityId: saved.id,
                details: { name: saved.name, source: "bulk-import-upsert" },
              });
            } else {
              results.created++;
              await auditLog({
                req, action: "create", entityType: "item", entityId: saved.id,
                details: { name: saved.name, source: "bulk-import" },
              });
            }
          } else {
            const [created] = await db.transaction(async (tx) => {
              const [row] = await tx.insert(itemsTable).values(values).returning();
              const globalId = await ensureEntityIdentity(tx, "item", row.id);
              await recordLocalChange(tx, {
                nodeId: bulkNode.nodeId,
                entityType: "item",
                localEntityId: row.id,
                globalId,
                changeType: "create",
                payload: {
                  ...row,
                  categoryGlobalId: row.categoryId
                    ? await ensureEntityIdentity(tx, "category", row.categoryId)
                    : null,
                },
              });
              if (row.currentStock > 0) {
                const openingDate = new Date().toISOString().slice(0, 10);
                const [batch] = await tx.insert(inventoryBatchesTable).values({
                  itemId: row.id,
                  receivedQuantity: row.currentStock,
                  remainingQuantity: row.currentStock,
                  deliveryNoteNumber: `افتتاحي-${row.id}`,
                  deliveryNoteDate: openingDate,
                  supplySource: "central_warehouses",
                }).returning();
                const batchGlobalId = await ensureEntityIdentity(tx, "inventory_batch", batch.id);
                await recordLocalChange(tx, {
                  nodeId: bulkNode.nodeId,
                  entityType: "inventory_batch",
                  localEntityId: batch.id,
                  globalId: batchGlobalId,
                  changeType: "create",
                  payload: { ...batch, itemGlobalId: globalId },
                });
              }
              return [row];
            });
            results.created++;
            await auditLog({
              req, action: "create", entityType: "item", entityId: created.id,
              details: { name: created.name, source: "bulk-import" },
            });
          }
        } catch (err: unknown) {
          const e = err as { cause?: { code?: string }; code?: string };
          const isDuplicate = e?.cause?.code === "23505" || e?.code === "23505";
          results.errors.push({
            row: rowNum,
            name,
            error: isDuplicate ? "الرمز مستخدم مسبقاً — استخدم وضع «تحديث وإضافة» لتحديثه" : "خطأ في الإدراج",
          });
        }
      }

      res.json(results);
      runAlertWorker();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/items/fefo-preview
router.get("/fefo-preview", requireAuth, async (req, res) => {
  try {
    const id = Number.parseInt(String(req.query.itemId ?? ""), 10);
    const quantity = Number.parseInt(String(req.query.quantity ?? ""), 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid item id" });
      return;
    }
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      res.status(400).json({ error: "الكمية يجب أن تكون عددًا صحيحًا أكبر من الصفر" });
      return;
    }

    const [item] = await db
      .select({
        id: itemsTable.id,
        itemType: itemsTable.itemType,
        currentStock: itemsTable.currentStock,
      })
      .from(itemsTable)
      .where(and(eq(itemsTable.id, id), eq(itemsTable.isActive, true)));

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    if (item.itemType !== "item") {
      res.status(400).json({ error: "معاينة FEFO متاحة للمواد المستهلكة فقط" });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const batches = await db
      .select({
        id: inventoryBatchesTable.id,
        remainingQuantity: inventoryBatchesTable.remainingQuantity,
        expiryDate: inventoryBatchesTable.expiryDate,
        batchNumber: inventoryBatchesTable.batchNumber,
      })
      .from(inventoryBatchesTable)
      .where(
        and(
          eq(inventoryBatchesTable.itemId, id),
          sql`${inventoryBatchesTable.remainingQuantity} > 0`,
        ),
      )
      .orderBy(sql`${inventoryBatchesTable.expiryDate} ASC NULLS LAST`, asc(inventoryBatchesTable.id));

    const normalizedBatches: FefoBatch[] = batches.map((batch) => ({
      id: batch.id,
      remainingQuantity: batch.remainingQuantity,
      expiryDate: batch.expiryDate,
      batchNumber: batch.batchNumber,
    }));
    const eligibleBatches = normalizedBatches.filter(
      (batch) => !batch.expiryDate || batch.expiryDate >= today,
    );
    const expiredBatches = normalizedBatches.filter(
      (batch) => Boolean(batch.expiryDate && batch.expiryDate < today),
    );
    const availableQuantity = eligibleBatches.reduce(
      (total, batch) => total + batch.remainingQuantity,
      0,
    );

    let allocations: ReturnType<typeof allocateBatchesFefo> = [];
    let canFulfill = false;
    try {
      allocations = allocateBatchesFefo(normalizedBatches, quantity, today);
      canFulfill = true;
    } catch (error) {
      if (
        !(error instanceof InventoryMovementError) ||
        error.code !== "INSUFFICIENT_BATCH_STOCK"
      ) {
        throw error;
      }
    }

    res.json({
      itemId: item.id,
      itemStock: item.currentStock,
      requestedQuantity: quantity,
      availableQuantity,
      canFulfill,
      allocations: allocations.map((allocation) => ({
        batchId: allocation.batchId,
        quantity: allocation.quantity,
        batchNumber: allocation.batchNumberSnap,
        expiryDate: allocation.expiryDateSnap,
      })),
      expiredBatches: expiredBatches.map((batch) => ({
        batchId: batch.id,
        remainingQuantity: batch.remainingQuantity,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/items/history?itemId=ID
router.get("/history", requireAuth, async (req, res) => {
  try {
    const id = Number.parseInt(String(req.query.itemId ?? ""), 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid item id" });
      return;
    }

    const type =
      typeof req.query.type === "string" && req.query.type
        ? req.query.type
        : undefined;
    if (type && !ITEM_HISTORY_TYPES.includes(type as ItemHistoryType)) {
      res.status(400).json({ error: "نوع الحركة غير صالح" });
      return;
    }

    const parseDateFilter = (value: unknown) => {
      if (value === undefined || value === "") return undefined;
      const normalized = String(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
      return normalized;
    };
    const from = parseDateFilter(req.query.from);
    const to = parseDateFilter(req.query.to);
    if (from === null || to === null) {
      res.status(400).json({ error: "صيغة التاريخ يجب أن تكون YYYY-MM-DD" });
      return;
    }

    const result = await getItemHistory(id, {
      type: type as ItemHistoryType | undefined,
      from,
      to,
      document:
        typeof req.query.document === "string" ? req.query.document.trim() : undefined,
      page: Number.parseInt(String(req.query.page ?? "1"), 10) || 1,
      limit: Number.parseInt(String(req.query.limit ?? "20"), 10) || 20,
    });
    if (!result) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid item id" }); return; }
    const [item] = await db
      .select({
        id: itemsTable.id,
        code: itemsTable.code,
        name: itemsTable.name,
        categoryId: itemsTable.categoryId,
        categoryName: categoriesTable.name,
        itemType: itemsTable.itemType,
        unit: itemsTable.unit,
        currentStock: itemsTable.currentStock,
        minStock: itemsTable.minStock,
        expiryDate: itemsTable.expiryDate,
        batchNumber: itemsTable.batchNumber,
        location: itemsTable.location,
        supplier: itemsTable.supplier,
        notes: itemsTable.notes,
        isActive: itemsTable.isActive,
        createdAt: itemsTable.createdAt,
        updatedAt: itemsTable.updatedAt,
      })
      .from(itemsTable)
      .leftJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .where(and(eq(itemsTable.id, id), eq(itemsTable.isActive, true)));

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/items/:id
router.put(
  "/:id",
  requireAuth,
  requireRole("admin", "warehouse_manager"),
  async (req, res) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const {
        code,
        name,
        categoryId,
        itemType,
        unit,
        minStock,
        expiryDate,
        batchNumber,
        location,
        supplier,
        notes,
      } = req.body;

      const updates: Partial<typeof itemsTable.$inferInsert> = {};
      if (code !== undefined) updates.code = code || null;
      if (name !== undefined) updates.name = name;
      if (categoryId !== undefined)
        updates.categoryId = categoryId ? parseInt(categoryId, 10) : null;
      if (itemType !== undefined) updates.itemType = itemType;
      if (unit !== undefined) updates.unit = unit;
      if (minStock !== undefined) updates.minStock = parseInt(minStock, 10);
      if (expiryDate !== undefined) updates.expiryDate = expiryDate || null;
      if (batchNumber !== undefined) updates.batchNumber = batchNumber || null;
      if (location !== undefined) updates.location = location || null;
      if (supplier !== undefined) updates.supplier = supplier || null;
      if (notes !== undefined) updates.notes = notes || null;

      const node = await ensureNodeIdentity("web");
      const item = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(itemsTable)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(itemsTable.id, id))
          .returning();
        if (!updated) return undefined;
        const globalId = await ensureEntityIdentity(tx, "item", updated.id);
        await recordLocalChange(tx, {
          nodeId: node.nodeId,
          entityType: "item",
          localEntityId: updated.id,
          globalId,
          changeType: "update",
          payload: {
            ...updated,
            categoryGlobalId: updated.categoryId
              ? await ensureEntityIdentity(tx, "category", updated.categoryId)
              : null,
          },
        });
        return updated;
      });

      if (!item) {
        res.status(404).json({ error: "Item not found" });
        return;
      }
      await auditLog({ req, action: "update", entityType: "item", entityId: item.id, details: { name: item.name } });
      res.json(item);
      runAlertWorker().catch((e) => console.error("Alert worker:", e));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// DELETE /api/items/:id (soft delete)
router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) { res.status(400).json({ error: "Invalid item id" }); return; }
      const node = await ensureNodeIdentity("web");
      const deleted = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(itemsTable)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(itemsTable.id, id))
          .returning();
        if (!updated) return undefined;
        const globalId = await ensureEntityIdentity(tx, "item", updated.id);
        await recordLocalChange(tx, {
          nodeId: node.nodeId,
          entityType: "item",
          localEntityId: updated.id,
          globalId,
          changeType: "delete",
          payload: {
            ...updated,
            categoryGlobalId: updated.categoryId
              ? await ensureEntityIdentity(tx, "category", updated.categoryId)
              : null,
          },
        });
        return updated;
      });
      if (!deleted) {
        res.status(404).json({ error: "Item not found" });
        return;
      }
      await auditLog({ req, action: "delete", entityType: "item", entityId: id, details: {} });
      res.status(204).send();
      runAlertWorker().catch((e) => console.error("Alert worker:", e));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
