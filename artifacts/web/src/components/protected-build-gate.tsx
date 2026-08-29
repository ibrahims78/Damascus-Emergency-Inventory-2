import { useEffect, useState } from "react";
import {
  formatLicenseError,
  getInstallDeviceId,
  verifyLicense,
  type LicenseResult,
} from "../../../../lib/license-core/src/index";

const DEVICE_STORAGE_KEY = "damascus-ems.protected.device-id";
const LICENSE_PLATFORM = ((import.meta.env.VITE_LICENSE_PLATFORM ?? "android") as "android" | "windows");
const LICENSE_PUBLIC_KEY = (import.meta.env.VITE_LICENSE_PUBLIC_KEY ?? "") || undefined;
const LICENSE_STORAGE_KEY = "damascus-ems.protected.license";

function statusMessage(result: LicenseResult): string {
  if (result.status === "unsupported") {
    return "لا يدعم هذا الجهاز التحقق الآمن من الترخيص. استخدم إصداراً أحدث من النظام.";
  }
  return formatLicenseError(result.status);
}

export function ProtectedBuildGate({ children }: { children: React.ReactNode }) {
  const [deviceId, setDeviceId] = useState("");
  const [license, setLicense] = useState("");
  const [result, setResult] = useState<LicenseResult | null>(null);
  const [checking, setChecking] = useState(true);
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = getInstallDeviceId(window.localStorage, DEVICE_STORAGE_KEY);
    const saved = window.localStorage.getItem(LICENSE_STORAGE_KEY) ?? "";
    setDeviceId(id);
    setLicense(saved);
    verifyLicense(saved, { platform: LICENSE_PLATFORM, deviceId: id, appVersion: import.meta.env.VITE_APP_VERSION ?? "*", publicKeySpkiBase64: LICENSE_PUBLIC_KEY })
      .then(setResult)
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200" dir="rtl">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-400 border-t-transparent" aria-label="جار التحقق" />
      </main>
    );
  }

  if (result?.status === "valid") return children;

  async function activate() {
    setActivating(true);
    const next = license.trim();
    const checked = await verifyLicense(next, {
      platform: LICENSE_PLATFORM,
      deviceId, publicKeySpkiBase64: LICENSE_PUBLIC_KEY,
      appVersion: import.meta.env.VITE_APP_VERSION ?? "*",
    });
    if (checked.status === "valid") {
      window.localStorage.setItem(LICENSE_STORAGE_KEY, next);
    }
    setResult(checked);
    setActivating(false);
  }

  async function copyDeviceId() {
    await navigator.clipboard?.writeText(deviceId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-100" dir="rtl">
      <section className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-3 text-4xl" aria-hidden="true">🔐</div>
          <h1 className="text-2xl font-bold text-sky-300">نسخة محمية</h1>
          <p className="mt-2 text-sm text-slate-400">نظام مستودع الإسعاف والطوارئ — دمشق</p>
        </div>

        <div className="rounded-xl border border-sky-700/70 bg-slate-950 p-4 text-center">
          <p className="mb-2 text-xs text-slate-400">معرّف هذا الجهاز</p>
          <code className="break-all text-sm font-bold tracking-widest text-sky-300">{deviceId}</code>
          <button
            type="button"
            onClick={copyDeviceId}
            className="mt-3 rounded-lg border border-sky-500 px-3 py-1.5 text-xs text-sky-300 transition hover:bg-sky-500/10"
          >
            {copied ? "تم النسخ" : "نسخ المعرّف"}
          </button>
        </div>

        <ol className="my-5 space-y-2 rounded-lg border-r-4 border-amber-500 bg-slate-800/70 p-4 text-sm text-slate-300">
          <li>1. انسخ معرّف الجهاز أعلاه.</li>
          <li>2. أرسله إلى مسؤول النظام لإصدار الترخيص.</li>
          <li>3. ألصق الترخيص الموقع في الحقل أدناه.</li>
        </ol>

        <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="protected-license">
          ملف أو نص الترخيص الموقع
        </label>
        <textarea
          id="protected-license"
          value={license}
          onChange={(event) => setLicense(event.target.value)}
          rows={5}
          dir="ltr"
          spellCheck={false}
          placeholder="eyJ... .signature..."
          className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-100 outline-none focus:border-sky-500"
        />
        {result && (
          <p className="mt-3 rounded-lg bg-red-950/50 p-3 text-sm text-red-300">{statusMessage(result)}</p>
        )}
        <button
          type="button"
          onClick={activate}
          disabled={activating || !license.trim()}
          className="mt-4 w-full rounded-lg bg-sky-600 px-4 py-3 font-bold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {activating ? "جارٍ التحقق..." : "تفعيل التطبيق"}
        </button>
        <p className="mt-4 text-center text-xs text-slate-500">لا يتم إرسال معرّف الجهاز أو الترخيص إلى خادم خارجي.</p>
      </section>
    </main>
  );
}