/**
 * Number formats (`xl/styles.xml`).
 *
 * A cell carries a style index (`s="12"`); the style index points at a cell
 * format (`cellXfs`), which points at a number format (`numFmtId`). Built-in
 * formats have no code in the file, so a small table of the ECMA-376 built-ins
 * is used; custom formats (`numFmts`) override nothing — they only exist for
 * ids >= 164.
 */
import { childNamed, childrenNamed, parseXml } from "./xml";

/** Format code meaning "no specific format"; omitted from the canonical view. */
export const GENERAL_FORMAT = "General";

/** ECMA-376 built-in number formats (ids without a code in `styles.xml`). */
export const BUILTIN_NUMBER_FORMATS: ReadonlyMap<number, string> = new Map([
  [0, "General"],
  [1, "0"],
  [2, "0.00"],
  [3, "#,##0"],
  [4, "#,##0.00"],
  [9, "0%"],
  [10, "0.00%"],
  [11, "0.00E+00"],
  [12, "# ?/?"],
  [13, "# ??/??"],
  [14, "mm-dd-yy"],
  [15, "d-mmm-yy"],
  [16, "d-mmm"],
  [17, "mmm-yy"],
  [18, "h:mm AM/PM"],
  [19, "h:mm:ss AM/PM"],
  [20, "h:mm"],
  [21, "h:mm:ss"],
  [22, "m/d/yy h:mm"],
  [37, "#,##0 ;(#,##0)"],
  [38, "#,##0 ;[Red](#,##0)"],
  [39, "#,##0.00;(#,##0.00)"],
  [40, "#,##0.00;[Red](#,##0.00)"],
  [45, "mm:ss"],
  [46, "[h]:mm:ss"],
  [47, "mmss.0"],
  [48, "##0.0E+0"],
  [49, "@"],
]);

/** Resolves the number format code of every cell format index. */
export type StyleFormats = string[];

/** Reads the number format code of each `cellXfs` entry. */
export function parseStyles(xml: string): StyleFormats {
  const root = parseXml(xml);
  const customs = parseCustomFormats(root);
  const cellXfs = childNamed(root, "cellxfs");
  if (!cellXfs) return [];
  const formats: StyleFormats = [];
  for (const xf of childrenNamed(cellXfs, "xf")) {
    const numFmtId = Number(xf.attrs["numfmtid"] ?? "0");
    formats.push(resolveFormatCode(numFmtId, customs));
  }
  return formats;
}

/** Custom format codes declared in `<numFmts>`. */
function parseCustomFormats(root: ReturnType<typeof parseXml>): Map<number, string> {
  const customs = new Map<number, string>();
  const numFmts = childNamed(root, "numfmts");
  if (!numFmts) return customs;
  for (const numFmt of childrenNamed(numFmts, "numfmt")) {
    const id = Number(numFmt.attrs["numfmtid"] ?? "");
    const code = numFmt.attrs["formatcode"];
    if (Number.isFinite(id) && code !== undefined) {
      customs.set(id, code);
    }
  }
  return customs;
}

/** Format code of a number format id, custom first, then built-ins. */
export function resolveFormatCode(numFmtId: number, customs: Map<number, string>): string {
  const custom = customs.get(numFmtId);
  if (custom !== undefined) return custom;
  return BUILTIN_NUMBER_FORMATS.get(numFmtId) ?? GENERAL_FORMAT;
}

/**
 * Format code of a cell style index; `General` when the index is unknown or
 * the format is the general one.
 */
export function formatOfStyle(formats: StyleFormats, styleIndex: number | undefined): string {
  if (styleIndex === undefined) return GENERAL_FORMAT;
  const code = formats[styleIndex];
  return code ?? GENERAL_FORMAT;
}

/**
 * Number format as stored in a `CellRecord`: the general format is written as
 * an empty string (and omitted from the TSV), any other code is kept as-is.
 */
export function canonicalFormat(code: string): string {
  return code === GENERAL_FORMAT ? "" : code;
}
