/**
 * Workbook metadata (`xl/workbook.xml` and `xl/_rels/workbook.xml.rels`).
 *
 * The sheet list gives the stable `sheetId`, the display name, the order and
 * the visibility state; the relationship part maps `r:id` to the worksheet
 * part path, which is *not* always `sheet1.xml`.
 */
import type { DefinedName, SheetMeta, SheetState } from "@suture/contracts";
import { childNamed, childrenNamed, parseXml } from "./xml";

/** A relationship of the workbook part. */

/** Sheet list and defined names of a workbook. */
export interface WorkbookParts {
  sheets: SheetMeta[];
  definedNames: DefinedName[];
}

/** Parses `xl/_rels/workbook.xml.rels` into `rId -> target` pairs. */
export function parseRelationships(xml: string): Map<string, string> {
  const root = parseXml(xml);
  const map = new Map<string, string>();
  for (const rel of childrenNamed(root, "relationship")) {
    const id = rel.attrs["id"];
    const target = rel.attrs["target"];
    if (id !== undefined && target !== undefined) {
      map.set(id, target);
    }
  }
  return map;
}

/** Resolves a relationship target against the workbook part directory. */
export function resolveTarget(target: string): string {
  const cleaned = target.replace(/^\//, "");
  if (cleaned.startsWith("xl/")) return cleaned;
  return `xl/${cleaned.replace(/^\.\//, "")}`;
}

/** Reads the sheet list and the defined names of a workbook. */
export function parseWorkbookMeta(
  workbookXml: string | undefined,
  relationships: Map<string, string>,
): WorkbookParts {
  const root = parseXml(workbookXml ?? "<workbook/>");
  const sheets = parseSheets(root, relationships);
  return { sheets, definedNames: parseDefinedNames(root, sheets) };
}

/** Reads the `<sheets>` element. */
function parseSheets(root: ReturnType<typeof parseXml>, relationships: Map<string, string>): SheetMeta[] {
  const container = childNamed(root, "sheets");
  if (!container) return [];
  const sheets: SheetMeta[] = [];
  let order = 0;
  for (const sheet of childrenNamed(container, "sheet")) {
    const relId = sheet.attrs["r:id"] ?? sheet.attrs["id"];
    const target = relId === undefined ? undefined : relationships.get(relId);
    sheets.push({
      sheetId: Number(sheet.attrs["sheetid"] ?? order),
      name: sheet.attrs["name"] ?? `Sheet${order + 1}`,
      order,
      state: readState(sheet.attrs["state"]),
      path: target === undefined ? "" : resolveTarget(target),
    });
    order += 1;
  }
  return sheets;
}

/** Reads the visibility state of a sheet; unknown states are visible. */
function readState(raw: string | undefined): SheetState {
  if (raw === "hidden" || raw === "veryHidden") return raw;
  return "visible";
}

/** Reads `<definedNames>`; `localSheetId` is turned into the stable `sheetId`. */
function parseDefinedNames(root: ReturnType<typeof parseXml>, sheets: SheetMeta[]): DefinedName[] {
  const container = childNamed(root, "definednames");
  if (!container) return [];
  const names: DefinedName[] = [];
  for (const defined of childrenNamed(container, "definedname")) {
    const name = defined.attrs["name"];
    if (name === undefined) continue;
    const local = defined.attrs["localsheetid"];
    const scoped = local === undefined ? undefined : sheets[Number(local)];
    names.push({
      name,
      formula: defined.text.trim(),
      ...(scoped === undefined ? {} : { sheetId: scoped.sheetId }),
    });
  }
  return names;
}
