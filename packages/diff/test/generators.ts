import fc from "fast-check";
import type { CanonicalSheet, CanonicalWorkbook, CellKind, CellRecord } from "@suture/contracts";

const cellKindArb: fc.Arbitrary<CellKind> = fc.constantFrom("n", "s", "b", "e", "f");

export const cellRecordArb: fc.Arbitrary<CellRecord> = fc.record({
  ref: fc
    .tuple(fc.constantFrom("A", "B", "C", "D", "E"), fc.integer({ min: 1, max: 30 }))
    .map(([col, row]) => `${col}${row}`),
  kind: cellKindArb,
  input: fc.string({ minLength: 1, maxLength: 20 }),
  cached: fc.string({ minLength: 0, maxLength: 10 }),
  fmt: fc.constantFrom("", "#,##0 €", "0.00%", "YYYY-MM-DD"),
});

export const canonicalSheetArb: fc.Arbitrary<CanonicalSheet> = fc
  .record({
    sheetId: fc.integer({ min: 1, max: 10 }),
    name: fc.constantFrom("Budget", "Hypotheses", "Staff", "Revenue"),
    cells: fc.uniqueArray(cellRecordArb, {
      selector: (cell) => cell.ref,
      maxLength: 25,
    }),
  })
  .map(({ sheetId, name, cells }) => ({
    meta: {
      sheetId,
      name,
      order: sheetId,
      state: "visible" as const,
      path: `xl/worksheets/sheet${sheetId}.xml`,
    },
    cells,
  }));

export const canonicalWorkbookArb: fc.Arbitrary<CanonicalWorkbook> = fc
  .uniqueArray(canonicalSheetArb, {
    selector: (sheet) => sheet.meta.sheetId,
    minLength: 1,
    maxLength: 4,
  })
  .map((sheets) => ({
    meta: { sheets: sheets.map((sheet) => sheet.meta), definedNames: [] },
    sheets,
  }));

/** Column letter for a 0-based index (A, B, C...). */
export function colLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** A grid sheet: `rows` rows of 1..4 cells each, all inputs distinct. */
export const gridSheetArb: fc.Arbitrary<CanonicalSheet> = fc
  .array(
    fc.array(fc.string({ minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 4 }),
    { minLength: 2, maxLength: 8 },
  )
  .map((rows) => {
    const cells: CellRecord[] = [];
    rows.forEach((values, rowIndex) => {
      values.forEach((value, colIndex) => {
        cells.push({
          ref: `${colLetter(colIndex)}${rowIndex + 1}`,
          kind: "s",
          input: `${value}#${rowIndex}-${colIndex}`,
          cached: "",
          fmt: "",
        });
      });
    });
    return {
      meta: {
        sheetId: 1,
        name: "Budget",
        order: 0,
        state: "visible" as const,
        path: "xl/worksheets/sheet1.xml",
      },
      cells,
    };
  });

/** Wraps a single sheet into a workbook. */
export function workbookOf(sheet: CanonicalSheet): CanonicalWorkbook {
  return { meta: { sheets: [sheet.meta], definedNames: [] }, sheets: [sheet] };
}

/**
 * Inserts `count` brand-new rows at `position`, shifting the rows below down.
 * The new rows carry inputs that cannot collide with existing ones.
 */
export function insertRows(sheet: CanonicalSheet, position: number, count: number): CanonicalSheet {
  const cells: CellRecord[] = [];
  for (const cell of sheet.cells) {
    const letters = cell.ref.replace(/[0-9]+$/, "");
    const row = Number(cell.ref.slice(letters.length));
    cells.push(row >= position ? { ...cell, ref: `${letters}${row + count}` } : cell);
  }
  for (let offset = 0; offset < count; offset += 1) {
    cells.push({
      ref: `A${position + offset}`,
      kind: "s",
      input: `INSERTED-${position}-${offset}`,
      cached: "",
      fmt: "",
    });
  }
  return { ...sheet, cells: cells.sort(byRef) };
}

const ROW_DIGITS = /[0-9]+$/;

export function byRef(a: CellRecord, b: CellRecord): number {
  const rowA = Number(ROW_DIGITS.exec(a.ref)?.[0] ?? 0);
  const rowB = Number(ROW_DIGITS.exec(b.ref)?.[0] ?? 0);
  if (rowA !== rowB) return rowA - rowB;
  return a.ref.localeCompare(b.ref);
}
