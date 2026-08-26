import assert from "node:assert/strict";
import postgres from "postgres";

const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:8080/api";
const password = "phase8-password";
const suffix = `${Date.now()}`;
const username = `__phase8_viewer_${suffix}`;
const passwordHash = "$2b$10$d6HKRcEO4obIEcCcYll4zOPXLlumrHS16zpj9eiE..daSAPevT/Fu";
const sql = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL) : null;
let userId = 0;
let cookie = "";

function rememberCookie(response) {
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(options.headers ?? {}),
    },
  });
  rememberCookie(response);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

async function cleanup() {
  if (sql && userId) {
    await sql`DELETE FROM audit_log WHERE user_id = ${userId}`;
    await sql`DELETE FROM users WHERE id = ${userId}`;
  }
  if (sql) await sql.end({ timeout: 2 });
}

try {
  assert(sql, "DATABASE_URL is required for the phase-eight acceptance smoke test");

  const health = await request("/healthz");
  assert.equal(health.response.status, 200);
  assert.equal(health.body?.status, "ok");
  console.log("PASS health endpoint");

  const previewOrigin =
    "https://ed9ad8a1-09af-45d0-9c05-fac15ee4b0d2-00-1d0io39gk7xsc.picard.replit.dev";
  const previewHealth = await request("/healthz", {
    headers: { Origin: previewOrigin },
  });
  assert.equal(previewHealth.response.status, 200);
  assert.equal(previewHealth.response.headers.get("access-control-allow-origin"), previewOrigin);
  assert.equal(previewHealth.response.headers.get("access-control-allow-credentials"), "true");
  console.log("PASS nested Replit preview CORS");

  const unauthenticated = await request("/reports/stock-position");
  assert.equal(unauthenticated.response.status, 401);
  console.log("PASS reports reject unauthenticated access");

  const [user] = await sql`
    INSERT INTO users (username, password_hash, full_name, role, is_active)
    VALUES (${username}, ${passwordHash}, 'Phase 8 acceptance viewer', 'viewer', true)
    RETURNING id
  `;
  userId = Number(user.id);

  const login = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  assert.equal(login.response.status, 200);
  console.log("PASS viewer login");

  const stockPosition = await request("/reports/stock-position");
  assert.equal(stockPosition.response.status, 200);
  assert(Array.isArray(stockPosition.body?.items));
  assert(Array.isArray(stockPosition.body?.equipment));
  assert(stockPosition.body?.generatedAt);
  console.log("PASS stock position report contract");

  const custodies = await request("/reports/custodies?overdueDays=14");
  assert.equal(custodies.response.status, 200);
  assert(Array.isArray(custodies.body?.records));
  assert.equal(typeof custodies.body?.totals?.outstandingQuantity, "number");
  assert.equal(custodies.body?.overdueDays, 14);
  console.log("PASS custody report contract and filter");

  const categories = await request("/categories", {
    method: "POST",
    body: JSON.stringify({ name: `__phase8_category_${suffix}`, type: "consumable" }),
  });
  assert.equal(categories.response.status, 403);
  console.log("PASS viewer cannot mutate categories");

  const categoryList = await request("/categories");
  assert.equal(categoryList.response.status, 200);
  console.log("PASS authenticated category read");

  console.log("Phase 8 acceptance smoke tests passed (7 checks).");
} finally {
  await cleanup();
}