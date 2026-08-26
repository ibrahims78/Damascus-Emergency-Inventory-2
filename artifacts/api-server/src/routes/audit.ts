import { Router } from "express";
import { db, auditLogTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { and, desc, gte, lte, eq, sql } from "drizzle-orm";

const router = Router();

// GET /api/audit — admin only, paginated audit log with optional filters
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const {
      from,
      to,
      userId,
      action,
      entityType,
      page = "1",
      limit = "50",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (from) conditions.push(gte(auditLogTable.createdAt, new Date(from)));
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLogTable.createdAt, toDate));
    }
    if (userId) conditions.push(eq(auditLogTable.userId, parseInt(userId)));
    if (action) conditions.push(eq(auditLogTable.action, action));
    if (entityType) conditions.push(eq(auditLogTable.entityType, entityType));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, countResult] = await Promise.all([
      db
        .select()
        .from(auditLogTable)
        .where(where)
        .orderBy(desc(auditLogTable.createdAt))
        .limit(limitNum)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogTable)
        .where(where),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    res.json({
      data: logs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
