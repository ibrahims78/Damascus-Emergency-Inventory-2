import { Router } from "express";
import { auditLog } from "../middlewares/audit";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  acknowledgeSyncPackage,
  applySyncPackage,
  createSyncSession,
  getSyncNode,
  getSyncPackage,
  getSyncSession,
  handshakeSyncSession,
  prepareSyncPackage,
} from "../lib/sync-service";
import {
  consumePairing,
  createPairing,
  getRelayPackage,
  listRelayPackages,
  listTrustedNodes,
  purgeExpiredRelayPackages,
  revokeTrustedNode,
  uploadRelayPackage,
} from "../lib/relay-service";
import { listSyncConflicts, resolveSyncConflict } from "../lib/conflict-service";

const router = Router();

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "تعذر تنفيذ عملية المزامنة";
}

router.use(requireAuth, requireRole("admin"));

// GET /api/sync/node — stable identity and the node's current vector.
router.get("/node", async (_req, res) => {
  try {
    res.json(await getSyncNode());
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

// POST /api/sync/sessions — create a durable two-node exchange.
router.post("/sessions", async (req, res) => {
  try {
    const targetNodeId = String(req.body?.targetNodeId ?? "");
    const session = await createSyncSession({
      sessionId: req.body?.sessionId ? String(req.body.sessionId) : undefined,
      sourceNodeId: req.body?.sourceNodeId ? String(req.body.sourceNodeId) : undefined,
      targetNodeId,
    });
    await auditLog({
      req,
      action: "sync_session_create",
      entityType: "sync_session",
      details: { sessionId: session.sessionId, targetNodeId },
    });
    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.get("/sessions/:sessionId", async (req, res) => {
  try {
    res.json(await getSyncSession(String(req.params.sessionId)));
  } catch (error) {
    res.status(404).json({ error: errorMessage(error) });
  }
});

// Exchange vectors and prepare the outgoing Delta. Repeating this call with
// the same vector returns the existing package rather than creating a second
// logical exchange.
router.post("/sessions/:sessionId/handshake", async (req, res) => {
  try {
    const node = await getSyncNode();
    const result = await handshakeSyncSession(
      String(req.params.sessionId),
      String(req.body?.nodeId ?? node.nodeId),
      req.body?.peerVector,
    );
    await auditLog({
      req,
      action: "sync_session_handshake",
      entityType: "sync_session",
      details: { sessionId: result.sessionId, nodeId: result.localNodeId },
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post("/sessions/:sessionId/manifest", async (req, res) => {
  try {
    const node = await getSyncNode();
    const pkg = await prepareSyncPackage(
      String(req.params.sessionId),
      String(req.body?.nodeId ?? node.nodeId),
      req.body?.baseVector,
    );
    res.json({
      packageId: pkg.packageId,
      sessionId: pkg.sessionId,
      direction: pkg.direction,
      sourceNodeId: pkg.sourceNodeId,
      targetNodeId: pkg.targetNodeId,
      baseVector: pkg.baseVector,
      lastVector: pkg.lastVector,
      contentHash: pkg.contentHash,
      changeCount: Array.isArray(pkg.changes) ? pkg.changes.length : 0,
      status: pkg.status,
    });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

// Upload a package received from the peer. The package is validated and
// applied atomically to Inbox/Change Log, then a detailed report is returned.
router.post("/sessions/:sessionId/packages", async (req, res) => {
  try {
    const node = await getSyncNode();
    const report = await applySyncPackage({
      sessionId: String(req.params.sessionId),
      nodeId: String(req.body?.nodeId ?? node.nodeId),
      packageId: String(req.body?.packageId ?? ""),
      direction: req.body?.direction,
      baseVector: req.body?.baseVector,
      lastVector: req.body?.lastVector,
      contentHash: String(req.body?.contentHash ?? ""),
      changes: req.body?.changes,
    });
    await auditLog({
      req,
      action: "sync_package_apply",
      entityType: "sync_package",
      details: { sessionId: report.packageId, packageId: report.packageId, counts: report.counts },
    });
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.get("/sessions/:sessionId/packages/:packageId", async (req, res) => {
  try {
    const pkg = await getSyncPackage(String(req.params.packageId));
    if (pkg.sessionId !== String(req.params.sessionId)) {
      res.status(404).json({ error: "SYNC_PACKAGE_NOT_FOUND" });
      return;
    }
    res.json(pkg);
  } catch (error) {
    res.status(404).json({ error: errorMessage(error) });
  }
});

router.post("/sessions/:sessionId/ack", async (req, res) => {
  try {
    const node = await getSyncNode();
    const result = await acknowledgeSyncPackage(
      String(req.params.sessionId),
      String(req.body?.packageId ?? ""),
      String(req.body?.nodeId ?? node.nodeId),
    );
    await auditLog({
      req,
      action: "sync_package_ack",
      entityType: "sync_package",
      details: { sessionId: req.params.sessionId, packageId: req.body?.packageId },
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post("/pairings", async (req, res) => {
  try {
    res.status(201).json(await createPairing({
      targetNodeId: req.body?.targetNodeId ? String(req.body.targetNodeId) : null,
      ttlMs: Number.isFinite(Number(req.body?.ttlMs)) ? Number(req.body.ttlMs) : undefined,
    }));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post("/pairings/consume", async (req, res) => {
  try {
    const result = await consumePairing({
      code: String(req.body?.code ?? ""),
      nodeId: String(req.body?.nodeId ?? ""),
      nodeType: req.body?.nodeType ?? "web",
      label: req.body?.label ? String(req.body.label) : null,
    });
    await auditLog({ req, action: "sync_pairing_consume", entityType: "sync_trusted_node", details: result });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.get("/trusted-nodes", async (_req, res) => {
  res.json(await listTrustedNodes());
});

router.post("/trusted-nodes/:nodeId/revoke", async (req, res) => {
  try {
    const nodeId = String(req.params.nodeId);
    const result = await revokeTrustedNode(nodeId);
    await auditLog({ req, action: "sync_trusted_node_revoke", entityType: "sync_trusted_node", details: { nodeId } });
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: errorMessage(error) });
  }
});

router.get("/conflicts", async (req, res) => {
  const requested = String(req.query.status ?? "open");
  const status = ["open", "resolved", "deferred", "all"].includes(requested)
    ? requested as "open" | "resolved" | "deferred" | "all"
    : "open";
  res.json(await listSyncConflicts(status));
});

router.post("/conflicts/:id/resolve", async (req, res) => {
  try {
    const conflictId = Number(req.params.id);
    const result = await resolveSyncConflict({
      conflictId,
      userId: res.locals.user.id,
      resolution: req.body?.resolution,
      correction: req.body?.correction,
    });
    await auditLog({
      req,
      action: "sync_conflict_resolve",
      entityType: "sync_conflict",
      details: { conflictId, resolution: req.body?.resolution },
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post("/relay/packages", async (req, res) => {
  try {
    const result = await uploadRelayPackage({
      sessionId: String(req.body?.sessionId ?? ""),
      packageId: String(req.body?.packageId ?? ""),
      responseToRelayId: req.body?.responseToRelayId ? String(req.body.responseToRelayId) : null,
      direction: req.body?.direction,
      sourceNodeId: String(req.body?.sourceNodeId ?? ""),
      targetNodeId: String(req.body?.targetNodeId ?? ""),
      contentHash: String(req.body?.contentHash ?? ""),
      payloadBase64: String(req.body?.payloadBase64 ?? ""),
      expiresAt: req.body?.expiresAt ? String(req.body.expiresAt) : undefined,
    });
    await auditLog({ req, action: "sync_relay_upload", entityType: "sync_relay_package", details: result });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.get("/relay/packages", async (req, res) => {
  res.json(await listRelayPackages(req.query.sessionId ? String(req.query.sessionId) : undefined));
});

router.get("/relay/packages/:relayId", async (req, res) => {
  try {
    const includePayload = req.query.download === "true";
    const result = await getRelayPackage(String(req.params.relayId), includePayload);
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: errorMessage(error) });
  }
});

router.delete("/relay/expired", async (_req, res) => {
  const result = await purgeExpiredRelayPackages();
  res.json({ deleted: result.length });
});

export default router;