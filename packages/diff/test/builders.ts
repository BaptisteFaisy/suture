import type { CanonicalSheet, CanonicalWorkbook, CellRecord } from "@suture/contracts";

/** Builds a cell record with sensible defaults. */
export function cell(
  ref: string,
  input: string,
  overrides: Partial<CellRecord> = {},
): CellRecord {
  return { ref, kind: "n", input, cached: "", fmt: "", ...overrides };
}

/** Builds a canonical sheet. */
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

/** Builds a canonical workbook from its sheets. */
export function workbook(...sheets: CanonicalSheet[]): CanonicalWorkbook {
  return {
    meta: { sheets: sheets.map((item) => item.meta), definedNames: [] },
    sheets,
  };
}
