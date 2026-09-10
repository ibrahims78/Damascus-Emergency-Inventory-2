import { describe, expect, it } from "vitest";
import {
  createCategoryLookup,
  normalizeDate,
  normalizeInventoryRow,
  normalizeInventoryInputMovement,
  normalizeOpeningBatchRow,
  validateInventoryOpeningBatchRows,
  validateInventoryImportRows,
} from "./inventory-import";

const context = {
  mode: "upsert" as const,
  categories: createCategoryLookup([{ id: 1, name: "مواد طبية" }]),
  existingByCode: new Map([
    ["0007", { id: 7, code: "0007", name: "شاش", requiresExpiryTracking: true }],
  ]),
};

describe("shared inventory import contract", () => {
  it("normalizes legacy Arabic headers without losing leading zero codes", () => {
    const row = normalizeInventoryRow({
      "الرمز": " 0007 ",
      "الاسم *": " شاش ",
      "الوحدة *": "رول",
      "تاريخ الانتهاء": "31/12/2026",
      "الكمية الحالية": "5",
    }, 2);
    expect(row.code).toBe("0007");
    expect(row.name).toBe("شاش");
    expect(row.expiryDate).toBe("2026-12-31");
    expect(row.currentStock).toBe(5);
  });

  it("supports Excel serial dates and rejects invalid dates", () => {
    expect(normalizeDate(46022).error).toBeNull();
    expect(normalizeDate("2026-02-31").error).toBeTruthy();
  });

  it("returns the same decisions for duplicate, unknown category, and stock changes", () => {
    const results = validateInventoryImportRows([
      { "الرمز": "0007", "الاسم": "شاش", "الوحدة": "رول", "الكمية الحالية": 2 },
      { "الرمز": "0007", "الاسم": "شاش آخر", "الوحدة": "رول", "التصنيف": "غير موجود" },
    ], context);
    expect(results[0].errors.map((issue) => issue.code)).toEqual([
      "STOCK_CHANGE_NOT_ALLOWED",
      "EXPIRY_REQUIRED",
    ]);
    expect(results[1].errors.map((issue) => issue.code)).toContain("UNKNOWN_CATEGORY");
    expect(results[1].errors.map((issue) => issue.code)).toContain("DUPLICATE_CODE_IN_FILE");
  });

  it("keeps blank rows empty and reports duplicate headers consistently", () => {
    const [blank, duplicate] = validateInventoryImportRows([
      {},
      { "الاسم": "شاش", "الاسم *": "شاش آخر", "الوحدة": "رول" },
    ], {
      mode: "insert",
      categories: context.categories,
      existingByCode: new Map(),
    });

    expect(blank.state).toBe("empty");
    expect(blank.action).toBe("none");
    expect(duplicate.errors.map((issue) => issue.code)).toContain("DUPLICATE_HEADER");
  });

  it("normalizes the opening-batch sheet and the shared input movement model", () => {
    const row = normalizeOpeningBatchRow({
      "رمز المادة": "0007",
      "الكمية الافتتاحية": "12",
      "رقم الدفعة": "B-01",
      "تاريخ الصلاحية": "2027-01-31",
      "رقم سند الإدخال": "GRN-7",
      "تاريخ سند الإدخال": "31/01/2027",
    }, 2);

    expect(row).toMatchObject({
      code: "0007",
      quantity: 12,
      expiryDate: "2027-01-31",
      deliveryNoteNumber: "GRN-7",
      deliveryNoteDate: "2027-01-31",
    });

    const movement = normalizeInventoryInputMovement({
      "رمز المادة": "0007",
      "الكمية الافتتاحية": 12,
      "رقم سند الإدخال": "GRN-7",
    }, 2, "opening-import");
    expect(movement).toMatchObject({
      itemCode: "0007",
      quantity: 12,
      source: "opening-import",
    });
  });

  it("produces a create-batch decision and rejects repeated opening batches", () => {
    const decisions = validateInventoryOpeningBatchRows([
      { "رمز المادة": "0007", "الكمية الافتتاحية": 4, "رقم الدفعة": "B-01", "تاريخ الصلاحية": "2027-01-31" },
      { "رمز المادة": "0007", "الكمية الافتتاحية": 3, "رقم الدفعة": "B-01", "تاريخ الصلاحية": "2027-01-31" },
    ], {
      existingByCode: context.existingByCode,
    });

    expect(decisions[0].action).toBe("create-opening-batch");
    expect(decisions[0].state).toBe("valid");
    expect(decisions[1].errors.map((issue) => issue.code)).toContain("DUPLICATE_BATCH_IN_FILE");
  });
});