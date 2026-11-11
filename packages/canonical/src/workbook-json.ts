/**
 * `cells/_workbook.json` — the sheet list and the defined names.
 */
import type { DefinedName, WorkbookMeta } from "@suture/contracts";

/** One sheet entry of `_workbook.json`. */
export interface WorkbookJsonSheet {
  sheetId: number;
  name: string;
  order: number;
  state: string;
  path: string;
}

/** The whole content of `_workbook.json`. */
export interface WorkbookJson {
  sheets: WorkbookJsonSheet[];
  definedNames: DefinedName[];
}

/** Builds the JSON-ready view of the workbook metadata. */
export function buildWorkbookJson(meta: WorkbookMeta): WorkbookJson {
  const sheets = [...meta.sheets]
    .sort((a, b) => a.order - b.order)
    .map((sheet) => ({
      sheetId: sheet.sheetId,
      name: sheet.name,
      order: sheet.order,
      state: sheet.state,
      path: sheet.path,
    }));
  return { sheets, definedNames: meta.definedNames.map((name) => ({ ...name })) };
}

/** Serializes `cells/_workbook.json` — stable key order, two-space indent. */
export function serializeWorkbookJson(meta: WorkbookMeta): string {
  return `${JSON.stringify(buildWorkbookJson(meta), null, 2)}\n`;
}
