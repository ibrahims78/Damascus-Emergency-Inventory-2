import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { desktopMode, pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { startAlertWorker } from "./lib/alert-worker";
import "./types/session.d.ts";

// ── Enforce SESSION_SECRET in production ─────────────────────────────────────
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === "production") {
  logger.error("SESSION_SECRET environment variable is required in production. Exiting.");
  process.exit(1);
}

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── CORS: restrict to same-origin and known Replit preview/deployment domains.
// Preview URLs may include an extra routing label, e.g. *.picard.replit.dev.
const allowedOriginPattern =
  /^(?:https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?|https:\/\/(?:[a-z0-9-]+\.)+replit\.(?:dev|app))$/i;
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server (no Origin header) and same-origin requests
      if (!origin) return callback(null, true);
      if (allowedOriginPattern.test(origin)) return callback(null, true);
      callback(new Error(`CORS: origin not allowed — ${origin}`));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "64mb" }));
app.use(express.urlencoded({ extended: true, limit: "4mb" }));

const PgSession = connectPgSimple(session);
const sessionStore = desktopMode
  ? undefined
  : new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    });

app.use(
  session({
    ...(sessionStore ? { store: sessionStore } : {}),
    secret: sessionSecret || "fallback-dev-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      // The embedded Electron API is served over loopback HTTP. A Secure
      // cookie would be rejected by Chromium there, which makes setup/login
      // appear successful while every subsequent protected request is 401.
      secure: process.env.NODE_ENV === "production" && !desktopMode,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

app.use("/api", router);

// Start background alert worker (checks inventory every 2 h, runs once on boot)
startAlertWorker();

export default app;
