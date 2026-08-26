import { gunzipSync } from 'fflate';
import scryptModule from 'scrypt-js';

type SyncRecord = {
  entityType: string;
  localId?: number | null;
  data: Record<string, unknown>;
};

type SyncPackage = {
  manifest: {
    format: string;
    formatVersion: number;
    packageType: string;
    schemaVersion: string;
    createdAt: string;
    sourceNodeId: string;
    recordCount: number;
    changeCount: number;
    [key: string]: unknown;
  };
  records: SyncRecord[];
  changes: unknown[];
  packageHash: string;
};

const MAGIC = new TextEncoder().encode('DME-SYNC\n');
const SCRYPT = scryptModule.scrypt;

function bytesEqual(left: Uint8Array, right: Uint8Array) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toHex(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(value: Uint8Array) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', value as BufferSource));
}

async function hmacSha256(key: Uint8Array, value: Uint8Array) {
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, value as BufferSource));
}

async function deriveKeys(password: string, salt: Uint8Array) {
  if (password.length < 8) throw new Error('كلمة مرور الحزمة غير صحيحة');
  // scrypt-js resolves its Promise with the derived key. Its optional
  // progress callback receives only a number, so waiting for a key in that
  // callback leaves restore permanently pending.
  const derived = await SCRYPT(
    new TextEncoder().encode(password),
    salt,
    16384,
    8,
    1,
    64,
  );
  return { encryptionKey: derived.slice(0, 32), macKey: derived.slice(32) };
}

function parsePlaintext(value: Uint8Array) {
  let parsedManifest: SyncPackage['manifest'] | undefined;
  const records: SyncRecord[] = [];
  const changes: unknown[] = [];
  for (const line of new TextDecoder().decode(value).split('\n').filter(Boolean)) {
    const entry = JSON.parse(line) as { type?: string; manifest?: SyncPackage['manifest']; record?: SyncRecord; change?: unknown };
    if (entry.type === 'manifest') parsedManifest = entry.manifest;
    else if (entry.type === 'record' && entry.record) records.push(entry.record);
    else if (entry.type === 'change' && entry.change) changes.push(entry.change);
  }
  if (!parsedManifest || parsedManifest.format !== 'dme-sync' || parsedManifest.formatVersion !== 1) {
    throw new Error('تنسيق حزمة النسخ غير مدعوم');
  }
  if (parsedManifest.recordCount !== records.length || parsedManifest.changeCount !== changes.length) {
    throw new Error('بيانات الحزمة غير مكتملة');
  }
  return { manifest: parsedManifest, records, changes };
}

export async function readDmeSyncPackage(input: Uint8Array, password: string): Promise<SyncPackage> {
  if (input.length <= MAGIC.length || !bytesEqual(input.slice(0, MAGIC.length), MAGIC)) {
    throw new Error('ملف النسخة غير صالح أو غير مكتمل');
  }
  const newline = input.indexOf(10, MAGIC.length);
  if (newline < 0) throw new Error('رأس ملف النسخة غير مكتمل');
  const header = JSON.parse(new TextDecoder().decode(input.slice(MAGIC.length, newline))) as {
    formatVersion: number;
    salt: string;
    iv: string;
    authTag: string;
    checksum: string;
    mac: string;
    ciphertext: string;
  };
  if (header.formatVersion !== 1) throw new Error('إصدار ملف النسخة غير مدعوم');
  const salt = fromBase64(header.salt);
  const iv = fromBase64(header.iv);
  const authTag = fromBase64(header.authTag);
  const ciphertext = fromBase64(header.ciphertext);
  const checksum = toHex(await sha256(ciphertext));
  if (checksum !== header.checksum) throw new Error('فشل التحقق من سلامة ملف النسخة');
  const { encryptionKey, macKey } = await deriveKeys(password, salt);
  const macInput = new Uint8Array(salt.length + iv.length + authTag.length + ciphertext.length);
  macInput.set(salt, 0);
  macInput.set(iv, salt.length);
  macInput.set(authTag, salt.length + iv.length);
  macInput.set(ciphertext, salt.length + iv.length + authTag.length);
  const actualMac = toHex(await hmacSha256(macKey, macInput));
  if (actualMac !== header.mac) throw new Error('كلمة مرور الحزمة غير صحيحة أو تم تعديل الملف');
  try {
    const cryptoKey = await crypto.subtle.importKey('raw', encryptionKey as BufferSource, 'AES-GCM', false, ['decrypt']);
    const encrypted = new Uint8Array(ciphertext.length + authTag.length);
    encrypted.set(ciphertext);
    encrypted.set(authTag, ciphertext.length);
    const compressed = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encrypted as BufferSource));
    const parsed = parsePlaintext(gunzipSync(compressed));
    return { ...parsed, packageHash: toHex(await sha256(input)) };
  } catch {
    throw new Error('تعذر فك تشفير الحزمة أو ضغطها');
  }
}

export async function readDmeSyncPackageInWorker(input: Uint8Array, password: string): Promise<SyncPackage> {
  // Capacitor's Android WebView does not consistently support module workers
  // for bundled local assets. Keep the worker for regular browsers, but never
  // leave an Android restore request pending when the worker cannot start.
  const nativeCapacitor = typeof window !== 'undefined' && Boolean(
    (window as Window & { Capacitor?: unknown }).Capacitor,
  );
  const androidWebView = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  if (nativeCapacitor || androidWebView || typeof Worker === 'undefined') {
    return readDmeSyncPackage(input, password);
  }
  const worker = new Worker(new URL('./dme-sync-worker.ts', import.meta.url), { type: 'module' });
  const transferableInput = input.slice();
  return new Promise<SyncPackage>((resolve, reject) => {
    let settled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();
      void readDmeSyncPackage(input, password).then(resolve, reject);
    }, 8_000);
    const finish = () => worker.terminate();
    worker.onmessage = (event: MessageEvent<{ ok: true; value: SyncPackage } | { ok: false; message: string }>) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackTimer);
      finish();
      if (event.data.ok) resolve(event.data.value);
      else reject(new Error(event.data.message));
    };
    worker.onerror = (event) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackTimer);
      finish();
      void readDmeSyncPackage(input, password).then(resolve, reject);
    };
    worker.postMessage({ input: transferableInput, password }, [transferableInput.buffer]);
  });
}

export function dmePackageSummary(pkg: SyncPackage) {
  return {
    packageHash: pkg.packageHash,
    manifest: pkg.manifest,
    recordCount: pkg.records.length,
    changeCount: pkg.changes.length,
    entityTypes: [...new Set(pkg.records.map((record) => record.entityType))].sort(),
  };
}