import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, systemSettingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { auditLog } from "../middlewares/audit";
import { eq } from "drizzle-orm";
import { getPasswordPolicyError } from "../lib/password-policy";

const router = Router();

// ── Simple in-memory rate limiter for auth endpoints ─────────────────────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

function saveSession(req: Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const key = String(req.ip ?? "unknown");
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_ATTEMPTS) {
      res.status(429).json({ error: "Too many attempts. Please try again later." });
      return;
    }
    entry.count++;
  } else {
    loginAttempts.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
  }
  next();
}

// Clean stale entries periodically (every 30 min)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of loginAttempts.entries()) {
    if (now >= v.resetAt) loginAttempts.delete(k);
  }
}, 30 * 60 * 1000).unref();

// GET /api/auth/setup-status
router.get("/setup-status", async (_req, res) => {
  try {
    const admin = await db.query.usersTable.findFirst({
      where: (u, { eq }) => eq(u.role, "admin"),
      columns: { id: true },
    });
    res.json({ needsSetup: !admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/setup
router.post("/setup", loginRateLimiter, async (req, res) => {
  try {
    // Only allowed if no admin exists
    const existing = await db.query.usersTable.findFirst({
      where: (u, { eq }) => eq(u.role, "admin"),
      columns: { id: true },
    });
    if (existing) {
      res.status(409).json({ error: "Admin already exists" });
      return;
    }
    const { username, password, fullName } = req.body as {
      username?: string;
      password?: string;
      fullName?: string;
    };
    if (!username || !password || !fullName) {
      res.status(400).json({ error: "username, password, and fullName are required" });
      return;
    }
    const passwordError = getPasswordPolicyError(password);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(usersTable)
      .values({ username, passwordHash, fullName, role: "admin" })
      .returning();

    // Mark setup as completed in system settings
    const existingSettings = await db.query.systemSettingsTable.findFirst();
    if (existingSettings) {
      await db
        .update(systemSettingsTable)
        .set({ setupCompleted: true, setupAt: new Date() })
        .where(eq(systemSettingsTable.id, existingSettings.id));
    } else {
      await db.insert(systemSettingsTable).values({ setupCompleted: true, setupAt: new Date() });
    }

    // Regenerate session to prevent session fixation
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve()))
    );
    req.session.userId = user.id;
    await saveSession(req);
    res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", loginRateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }
    const user = await db.query.usersTable.findFirst({
      where: (u, { eq, and }) => and(eq(u.username, username), eq(u.isActive, true)),
    });
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    // Regenerate session to prevent session fixation
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve()))
    );
    req.session.userId = user.id;
    await saveSession(req);
    await auditLog({ req, action: "login", entityType: "user", entityId: user.id, details: { username: user.username } });
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/logout
// Logout is intentionally idempotent: an expired or already-destroyed
// session should still be treated as a successful logout.
router.post("/logout", async (req, res) => {
  try {
    const user = res.locals.user as { id?: number; username?: string } | undefined;
    if (user?.id) {
      await auditLog({ req, action: "logout", entityType: "user", entityId: user.id, details: { username: user.username } });
    }
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  } catch {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  const user = res.locals.user;
  res.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
  });
});

export default router;
