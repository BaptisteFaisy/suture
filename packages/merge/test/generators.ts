/**
 * Generators for the combine properties: a base grid of values, then one or
 * two edited copies of it. Workbooks stay comparable (same sheets, same
 * addresses), which is what makes the properties meaningful.
 */
import fc from "fast-check";
import type { CanonicalSheet, CanonicalWorkbook, CellRecord } from "@suture/contracts";

const COLUMNS = ["A", "B", "C", "D"];

/** A cell of the synthetic grid. */
export function cell(ref: string, input: string): CellRecord {
  return { ref, kind: "n", input, cached: "", fmt: "" };
}

/** A sheet holding the given cells. */
export function sheet(sheetId: number, name: string, cells: CellRecord[]): CanonicalSheet {
  return {
    meta: {
      sheetId,
      name,
      order: sheetId - 1,
      state: "visible",
      path: `xl/worksheets/sheet${sheetId}.xml`,
    },
    cells,
  };
}

/** A workbook from its sheets. */
export function workbook(...sheets: CanonicalSheet[]): CanonicalWorkbook {
  return {
    meta: { sheets: sheets.map((item) => item.meta), definedNames: [] },
    sheets,
  };
}

/** A base grid: rows of values, addressed A1, B1, A2, ... */
export const gridArb: fc.Arbitrary<CellRecord[]> = fc
  .array(fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 3 }), {
    minLength: 2,
    maxLength: 6,
  })
  .map((rows) => {
    const cells: CellRecord[] = [];
    rows.forEach((values, rowIndex) => {
      values.forEach((value, colIndex) => {
        const column = COLUMNS[colIndex] ?? "A";
        cells.push(cell(`${column}${rowIndex + 1}`, `${value}#${rowIndex}-${colIndex}`));
      });
    });
    return cells;
  });

/** One edit: an address of the grid and its new value. */
export const editArb: fc.Arbitrary<{ ref: string; value: string }> = fc.record({
  ref: fc.constantFrom("A1", "B1", "C1", "A2", "B2", "C2", "A3", "B3", "C3"),
  value: fc.string({ minLength: 1, maxLength: 5 }),
});

/** Applies edits to a grid: a new value, or an empty cell when cleared. */
export function applyEdits(cells: CellRecord[], edits: { ref: string; value: string }[]): CellRecord[] {
  const map = new Map(edits.map((edit) => [edit.ref, edit.value]));
  const result: CellRecord[] = [];
  for (const item of cells) {
    const value = map.get(item.ref);
    if (value === undefined) {
      result.push(item);
      continue;
    }
    map.delete(item.ref);
    result.push(cell(item.ref, value));
  }
  for (const [ref, value] of map) result.push(cell(ref, value));
  return result.sort((a, b) => a.ref.localeCompare(b.ref));
}

/** The origin workbook and an edited copy of it. */
export const editedPairArb: fc.Arbitrary<{
  origin: CanonicalWorkbook;
  edited: CanonicalWorkbook;
}> = gridArb.chain((cells) =>
  fc.array(editArb, { minLength: 0, maxLength: 4 }).map((edits) => ({
    origin: workbook(sheet(1, "Budget", cells)),
    edited: workbook(sheet(1, "Budget", applyEdits(cells, edits))),
  })),
);

/** The origin workbook and two edited copies of it. */
export const twoSidesArb: fc.Arbitrary<{
  origin: CanonicalWorkbook;
  a: CanonicalWorkbook;
  b: CanonicalWorkbook;
}> = gridArb.chain((cells) =>
  fc
    .array(editArb, { minLength: 0, maxLength: 3 })
    .chain((editsA) =>
      fc.array(editArb, { minLength: 0, maxLength: 3 }).map((editsB) => ({
        origin: workbook(sheet(1, "Budget", cells)),
        a: workbook(sheet(1, "Budget", applyEdits(cells, editsA))),
        b: workbook(sheet(1, "Budget", applyEdits(cells, editsB))),
      })),
    ),
);

/** Two edited copies touching disjoint cells: no disagreement is possible. */
export const disjointSidesArb: fc.Arbitrary<{
  origin: CanonicalWorkbook;
  a: CanonicalWorkbook;
  b: CanonicalWorkbook;
}> = gridArb.chain((cells) => {
  const left = fc.array(editArb, { minLength: 1, maxLength: 2 }).map((edits) =>
    edits.filter((edit) => ["A1", "A2", "A3"].includes(edit.ref)),
  );
  const right = fc.array(editArb, { minLength: 1, maxLength: 2 }).map((edits) =>
    edits.filter((edit) => ["C1", "C2", "C3"].includes(edit.ref)),
  );
  return left.chain((editsA) =>
    right.map((editsB) => ({
      origin: workbook(sheet(1, "Budget", cells)),
      a: workbook(sheet(1, "Budget", applyEdits(cells, editsA))),
      b: workbook(sheet(1, "Budget", applyEdits(cells, editsB))),
    })),
  );
});
