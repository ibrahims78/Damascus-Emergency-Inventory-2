export type ImportMode = "insert" | "upsert";

export type InventoryImportRow = {
  rowNumber: number;
  code: string | null;
  name: string;
  unit: string;
  categoryName: string | null;
  currentStock: number | null;
  minStock: number | null;
  expiryDate: string | null;
  batchNumber: string | null;
  supplier: string | null;
  location: string | null;
  notes: string | null;
  unknownHeaders: string[];
  dateError: string | null;
};

export type ExistingInventoryItem = {
  id: number;
  code: string | null;
  name: string;
  requiresExpiryTracking?: boolean | null;
  requiresBatchTracking?: boolean | null;
};

export type InventoryImportContext = {
  mode: ImportMode;
  categories: Map<string, number>;
  existingByCode: Map<string, ExistingInventoryItem>;
  seenCodes?: Set<string>;
};

export type InventoryImportIssue = {
  code: string;
  message: string;
};

export type InventoryImportDecision = {
  state: "valid" | "warning" | "error";
  action: "create-item" | "update-item" | "none";
  createsOpeningBatch: boolean;
  errors: InventoryImportIssue[];
  warnings: InventoryImportIssue[];
  row: InventoryImportRow;
  existingItem: ExistingInventoryItem | null;
};

export const INVENTORY_TEMPLATE_VERSION = "4.0";
export const INVENTORY_SHEET_NAMES = {
  items: "المواد",
  openingBatches: "الأرصدة والدفعات الافتتاحية",
  instructions: "التعليمات",
  referenceValues: "القيم المرجعية",
} as const;

export const INVENTORY_TEMPLATE_COLUMNS = {
  items: [
    { key: "code", label: "الرمز", required: false, type: "text" },
    { key: "name", label: "الاسم", required: true, type: "text" },
    { key: "unit", label: "الوحدة", required: true, type: "text" },
    { key: "categoryName", label: "التصنيف", required: false, type: "text" },
    { key: "minStock", label: "الحد الأدنى", required: false, type: "integer" },
    { key: "location", label: "الموقع", required: false, type: "text" },
    { key: "notes", label: "ملاحظات", required: false, type: "text" },
  ],
  openingBatches: [
    { key: "code", label: "رمز المادة", required: true, type: "text" },
    { key: "quantity", label: "الكمية الافتتاحية", required: true, type: "integer" },
    { key: "batchNumber", label: "رقم الدفعة", required: false, type: "text" },
    { key: "expiryDate", label: "تاريخ الصلاحية", required: false, type: "date" },
    { key: "supplier", label: "المورد", required: false, type: "text" },
    { key: "deliveryNoteNumber", label: "رقم سند الإدخال", required: false, type: "text" },
    { key: "deliveryNoteDate", label: "تاريخ سند الإدخال", required: false, type: "date" },
  ],
} as const;

const HEADER_ALIASES: Record<string, string> = {
  code: "code",
  "رمز المادة": "code",
  الرمز: "code",
  الاسم: "name",
  "اسم المادة": "name",
  name: "name",
  الوحدة: "unit",
  "وحدة القياس": "unit",
  unit: "unit",
  التصنيف: "categoryName",
  تصنيف: "categoryName",
  category: "categoryName",
  "الحد الأدنى": "minStock",
  "حد التنبيه": "minStock",
  minstock: "minStock",
  الرصيد: "currentStock",
  "الكمية الحالية": "currentStock",
  "الرصيد الحالي": "currentStock",
  الكمية: "currentStock",
  currentstock: "currentStock",
  "تاريخ الانتهاء": "expiryDate",
  "تاريخ الصلاحية": "expiryDate",
  الصلاحية: "expiryDate",
  expirydate: "expiryDate",
  "رقم الدفعة": "batchNumber",
  "رقم التشغيلة": "batchNumber",
  الدفعة: "batchNumber",
  batchnumber: "batchNumber",
  المورد: "supplier",
  supplier: "supplier",
  الموقع: "location",
  location: "location",
  ملاحظات: "notes",
  notes: "notes",
};

function headerKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ar");
}

export function normalizeHeader(value: unknown) {
  const normalized = headerKey(value);
  return HEADER_ALIASES[normalized] ?? normalized;
}

export function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

export function normalizeCode(value: unknown): string | null {
  return normalizeText(value);
}

export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function excelSerialToIso(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2958465) return null;
  const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
  const iso = date.toISOString().slice(0, 10);
  return isValidIsoDate(iso) ? iso : null;
}

export function normalizeDate(value: unknown): { value: string | null; error: string | null } {
  if (value === null || value === undefined || value === "") return { value: null, error: null };
  if (value instanceof Date) {
    const iso = value.toISOString().slice(0, 10);
    return { value: isValidIsoDate(iso) ? iso : null, error: isValidIsoDate(iso) ? null : "التاريخ غير صالح" };
  }
  if (typeof value === "number") {
    const iso = excelSerialToIso(value);
    return iso ? { value: iso, error: null } : { value: null, error: "رقم تاريخ Excel غير صالح" };
  }
  const normalized = String(value).trim();
  if (!normalized) return { value: null, error: null };
  if (isValidIsoDate(normalized)) return { value: normalized, error: null };
  const arabicDate = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (arabicDate) {
    const [, day, month, year] = arabicDate;
    const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    if (isValidIsoDate(iso)) return { value: iso, error: null };
  }
  return { value: null, error: "التاريخ غير صالح؛ استخدم YYYY-MM-DD" };
}

export function parseNonNegativeInteger(value: unknown, fallback: number | null = 0): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  const normalized = String(value).trim();
  return /^\d+$/.test(normalized) ? Number(normalized) : null;
}

export function normalizeInventoryRow(input: Record<string, unknown>, rowNumber: number): InventoryImportRow {
  const canonical: Record<string, unknown> = {};
  const unknownHeaders: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    const mapped = normalizeHeader(key);
    if (Object.prototype.hasOwnProperty.call(HEADER_ALIASES, headerKey(key)) || [
      "code", "name", "unit", "categoryName", "currentStock", "minStock",
      "expiryDate", "batchNumber", "supplier", "location", "notes",
    ].includes(mapped)) {
      canonical[mapped] = value;
    } else if (String(key).trim()) {
      unknownHeaders.push(String(key).trim());
    }
  }
  const date = normalizeDate(canonical.expiryDate);
  return {
    rowNumber,
    code: normalizeCode(canonical.code),
    name: normalizeText(canonical.name) ?? "",
    unit: normalizeText(canonical.unit) ?? "",
    categoryName: normalizeText(canonical.categoryName),
    currentStock: parseNonNegativeInteger(canonical.currentStock, 0),
    minStock: parseNonNegativeInteger(canonical.minStock, 0),
    expiryDate: date.value,
    batchNumber: normalizeText(canonical.batchNumber),
    supplier: normalizeText(canonical.supplier),
    location: normalizeText(canonical.location),
    notes: normalizeText(canonical.notes),
    unknownHeaders,
    dateError: date.error,
  };
}

export function createCategoryLookup(categories: Array<{ id: number; name: string }>) {
  return new Map(categories.map((category) => [headerKey(category.name), category.id]));
}

export function validateInventoryImportRow(
  row: InventoryImportRow,
  context: InventoryImportContext,
): InventoryImportDecision {
  const errors: InventoryImportIssue[] = [];
  const warnings: InventoryImportIssue[] = [];
  const existingItem = row.code ? context.existingByCode.get(row.code) ?? null : null;

  if (row.name.length < 2) errors.push({ code: "NAME_REQUIRED", message: "اسم المادة مطلوب (حرفان على الأقل)" });
  if (!row.unit) errors.push({ code: "UNIT_REQUIRED", message: "الوحدة مطلوبة" });
  if (row.currentStock === null) errors.push({ code: "INVALID_STOCK", message: "الكمية الافتتاحية يجب أن تكون عددًا صحيحًا غير سالب" });
  if (row.minStock === null) errors.push({ code: "INVALID_MIN_STOCK", message: "الحد الأدنى يجب أن يكون عددًا صحيحًا غير سالب" });
  if (row.dateError) errors.push({ code: "INVALID_DATE", message: row.dateError });
  if (row.unknownHeaders.length) {
    warnings.push({ code: "UNKNOWN_HEADER", message: `أعمدة غير معروفة: ${row.unknownHeaders.join("، ")}` });
  }

  if (row.categoryName && !context.categories.has(headerKey(row.categoryName))) {
    errors.push({ code: "UNKNOWN_CATEGORY", message: `التصنيف غير موجود: ${row.categoryName}` });
  }
  if (row.code && context.seenCodes?.has(row.code)) {
    errors.push({ code: "DUPLICATE_CODE_IN_FILE", message: `الرمز مكرر داخل الملف: ${row.code}` });
  }
  if (row.code && existingItem && context.mode === "insert") {
    errors.push({ code: "DUPLICATE_CODE", message: "الرمز مستخدم مسبقًا — استخدم وضع التحديث والإضافة" });
  }

  const openingQuantity = row.currentStock ?? 0;
  if (existingItem && openingQuantity > 0) {
    errors.push({ code: "STOCK_CHANGE_NOT_ALLOWED", message: "لا يمكن تغيير رصيد مادة موجودة من استيراد التعريفات؛ استخدم حركة إدخال أو تسوية" });
  }
  if (existingItem?.requiresExpiryTracking && openingQuantity > 0 && !row.expiryDate) {
    errors.push({ code: "EXPIRY_REQUIRED", message: "هذه المادة تتطلب تاريخ صلاحية للدفعة الافتتاحية" });
  }
  if (existingItem?.requiresBatchTracking && openingQuantity > 0 && !row.batchNumber) {
    errors.push({ code: "BATCH_REQUIRED", message: "هذه المادة تتطلب رقم دفعة للدفعة الافتتاحية" });
  }
  if (existingItem && (row.expiryDate || row.batchNumber || row.supplier)) {
    warnings.push({ code: "LEGACY_BATCH_FIELDS_IGNORED", message: "بيانات الدفعة في صف مادة موجودة لا تغيّر سجل الدفعات؛ استخدم ورقة الدفعات الافتتاحية" });
  }

  const action = errors.length
    ? "none"
    : existingItem
      ? "update-item"
      : "create-item";
  return {
    state: errors.length ? "error" : warnings.length ? "warning" : "valid",
    action,
    createsOpeningBatch: !errors.length && !existingItem && openingQuantity > 0,
    errors,
    warnings,
    row,
    existingItem,
  };
}

export function validateInventoryImportRows(
  inputs: Array<Record<string, unknown>>,
  context: Omit<InventoryImportContext, "seenCodes">,
) {
  const seenCodes = new Set<string>();
  return inputs.map((input, index) => {
    const row = normalizeInventoryRow(input, index + 2);
    const decision = validateInventoryImportRow(row, { ...context, seenCodes });
    if (row.code) seenCodes.add(row.code);
    return decision;
  });
}