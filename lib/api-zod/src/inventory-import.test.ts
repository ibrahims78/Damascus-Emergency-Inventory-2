import { describe, expect, it } from "vitest";
import {
  createCategoryLookup,
  normalizeDate,
  normalizeInventoryRow,
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
});