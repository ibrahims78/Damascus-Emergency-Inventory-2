import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type NodeInfo = { nodeId: string; installationId: string; nodeType: string; vector: Record<string, number> };
type TrustedNode = { nodeId: string; nodeType: string; label?: string | null; status: string; pairedAt: string };
type Conflict = {
  conflict: { id: number; conflictCode: string; severity: string; status: string; createdAt: string };
  change: { entityType: string; entityGlobalId: string; operationId: string; payload: unknown } | null;
};
type RelayPackage = {
  relayId: string;
  sessionId: string;
  packageId: string;
  direction: string;
  sourceNodeId: string;
  targetNodeId: string;
  status: string;
  expiresAt: string;
  transportHash: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/sync${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "تعذر تنفيذ طلب المزامنة");
  return body;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-SY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function SyncPage() {
  const [node, setNode] = useState<NodeInfo | null>(null);
  const [nodes, setNodes] = useState<TrustedNode[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [relayPackages, setRelayPackages] = useState<RelayPackage[]>([]);
  const [pairingCode, setPairingCode] = useState("");
  const [consumeCode, setConsumeCode] = useState("");
  const [pairingTargetNodeId, setPairingTargetNodeId] = useState("");
  const [consumeNodeId, setConsumeNodeId] = useState("");
  const [targetNodeId, setTargetNodeId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [nodeResult, trustedResult, conflictsResult, relayResult] = await Promise.all([
      api<NodeInfo>("/node"),
      api<TrustedNode[]>("/trusted-nodes"),
      api<Conflict[]>("/conflicts"),
      api<RelayPackage[]>("/relay/packages"),
    ]);
    setNode(nodeResult);
    setNodes(trustedResult);
    setConflicts(conflictsResult);
    setRelayPackages(relayResult);
  }, []);

  useEffect(() => {
    refresh().catch((error: Error) => setMessage(error.message));
  }, [refresh]);

  async function createPairing() {
    setBusy(true);
    try {
      const result = await api<{ code: string; expiresAt: string }>("/pairings", {
        method: "POST",
        body: JSON.stringify({ targetNodeId: pairingTargetNodeId || undefined }),
      });
      setPairingCode(result.code);
      setMessage(`رمز الاقتران صالح حتى ${formatDate(result.expiresAt)} ويُستخدم مرة واحدة.`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function consumePairing() {
    setBusy(true);
    try {
      await api("/pairings/consume", {
        method: "POST",
        body: JSON.stringify({ code: consumeCode, nodeId: consumeNodeId, nodeType: "web", label: "عقدة ويب" }),
      });
      setConsumeCode("");
      setConsumeNodeId("");
      setMessage("تمت إضافة العقدة إلى قائمة الثقة.");
      await refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resolveConflict(id: number, resolution: "approve" | "reject" | "defer") {
    setBusy(true);
    try {
      await api(`/conflicts/${id}/resolve`, { method: "POST", body: JSON.stringify({ resolution }) });
      setMessage("تم حفظ قرار التسوية في سجل التدقيق.");
      await refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadManualFile() {
    if (!manualFile || !sessionId || !node?.nodeId || !targetNodeId) {
      setMessage("أدخل Session ID وNode ID للوجهة واختر ملف .dme-sync أولاً.");
      return;
    }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await manualFile.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      const payloadBase64 = btoa(binary);
      await api("/relay/packages", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          packageId: manualFile.name,
          direction: "source-to-target",
          sourceNodeId: node.nodeId,
          targetNodeId,
          contentHash: "client-file-transfer",
          payloadBase64,
        }),
      });
      setManualFile(null);
      setMessage("تم رفع الملف المشفر إلى Relay. لا يقرأ الخادم محتواه.");
      await refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadManualFile(relayId: string, packageId: string) {
    setBusy(true);
    try {
      const result = await api<{ payloadBase64: string }>(`/relay/packages/${relayId}?download=true`);
      const binary = atob(result.payloadBase64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = packageId.endsWith(".dme-sync") ? packageId : `${packageId}.dme-sync`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("تم تنزيل الملف. يجب فحصه محلياً قبل التطبيق.");
      await refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">المزامنة والنسخ المرحّل</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          إدارة عقد المزامنة، نقل ملفات ‎.dme-sync‎ المشفرة، ومراجعة التعارضات قبل تطبيقها.
        </p>
      </div>

      {message && <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>هوية هذه العقدة</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">النوع: </span>{node?.nodeType ?? "—"}</div>
            <div className="break-all"><span className="text-muted-foreground">Node ID: </span>{node?.nodeId ?? "جار التحميل…"}</div>
            <div><span className="text-muted-foreground">التغييرات المسجلة: </span>{node ? Object.values(node.vector).reduce((sum, value) => sum + value, 0) : "—"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>اقتران عقدة</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={pairingTargetNodeId} onChange={(event) => setPairingTargetNodeId(event.target.value)} placeholder="Node ID للوجهة (اختياري)" dir="ltr" />
              <Button onClick={createPairing} disabled={busy}>إنشاء رمز</Button>
            </div>
            {pairingCode && <div className="rounded border border-primary/30 bg-primary/5 p-4 text-center text-2xl font-bold tracking-[0.3em]" dir="ltr">{pairingCode}</div>}
            <div className="flex gap-2">
              <Input value={consumeCode} onChange={(event) => setConsumeCode(event.target.value)} placeholder="إدخال رمز من عقدة أخرى" dir="ltr" />
              <Input value={consumeNodeId} onChange={(event) => setConsumeNodeId(event.target.value)} placeholder="Node ID للعقدة المصدر" dir="ltr" />
              <Button variant="outline" onClick={consumePairing} disabled={busy || !consumeCode || !consumeNodeId}>اعتماد</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>العقد الموثوقة</CardTitle></CardHeader>
        <CardContent>
          {nodes.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد عقد مقترنة بعد.</p> : (
            <div className="space-y-2">
              {nodes.map((trusted) => (
                <div key={trusted.nodeId} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
                  <div><strong>{trusted.label || trusted.nodeType}</strong><div className="break-all text-xs text-muted-foreground" dir="ltr">{trusted.nodeId}</div></div>
                  <div className="flex items-center gap-2"><Badge variant={trusted.status === "trusted" ? "default" : "secondary"}>{trusted.status === "trusted" ? "موثوقة" : "ملغاة"}</Badge><span className="text-xs text-muted-foreground">{formatDate(trusted.pairedAt)}</span></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>نقل ملف ‎.dme-sync‎ يدوياً</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">يُحفظ الملف مشفراً كما هو؛ Relay لا يفك التشفير ولا يطبّق الحزمة.</p>
            <Input type="file" accept=".dme-sync,application/octet-stream" onChange={(event) => setManualFile(event.target.files?.[0] ?? null)} />
            <Button className="w-full" onClick={uploadManualFile} disabled={busy || !manualFile}>رفع إلى Relay</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>حزم Relay المتاحة</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={sessionId} onChange={(event) => setSessionId(event.target.value)} placeholder="تصفية حسب Session ID" dir="ltr" />
            {relayPackages.filter((item) => !sessionId || item.sessionId === sessionId).map((item) => (
              <div key={item.relayId} className="rounded border p-3 text-xs">
                <div className="flex justify-between gap-2"><Badge>{item.status}</Badge><span>{formatDate(item.expiresAt)}</span></div>
                <div className="mt-1 break-all" dir="ltr">{item.relayId}</div>
                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span>{item.direction} · {item.packageId}</span>
                  <Button size="sm" variant="outline" onClick={() => downloadManualFile(item.relayId, item.packageId)} disabled={busy}>تنزيل</Button>
                </div>
              </div>
            ))}
            {relayPackages.length === 0 && <p className="text-sm text-muted-foreground">لا توجد حزم معلقة.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>طابور التعارضات</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {conflicts.length === 0 && <p className="text-sm text-muted-foreground">لا توجد تعارضات مفتوحة.</p>}
            {conflicts.map(({ conflict, change }) => (
              <div key={conflict.id} className="rounded border p-3">
                <div className="flex items-center justify-between gap-2"><strong>{conflict.conflictCode}</strong><Badge variant={conflict.severity === "critical" || conflict.severity === "high" ? "destructive" : "secondary"}>{conflict.severity}</Badge></div>
                <p className="mt-1 text-xs text-muted-foreground">{change?.entityType} · {change?.entityGlobalId}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => resolveConflict(conflict.id, "approve")} disabled={busy}>اعتماد</Button>
                  <Button size="sm" variant="outline" onClick={() => resolveConflict(conflict.id, "reject")} disabled={busy}>رفض</Button>
                  <Button size="sm" variant="ghost" onClick={() => resolveConflict(conflict.id, "defer")} disabled={busy}>تأجيل</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}