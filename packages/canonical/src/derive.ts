/**
 * Canonical derivation — from OOXML parts to the `cells/` view.
 *
 * The derivation is a pure function of the parts: it never depends on the
 * order of the entries of the archive, and it never mutates its input.
 */
import type { CanonicalWorkbook, OoxmlPart, OoxmlParts } from "@suture/contracts";
import { sortParts } from "@suture/ooxml-io";
import { resolveFormulaCodec, type FormulaCodec } from "./formula-codec";
import { CUSTOM_PROPERTIES_PART_PATH, stripSutureProperties } from "./origin-marker";
import { parseSharedStrings } from "./shared-strings";
import { parseStyles } from "./styles";
import { parseRelationships, parseWorkbookMeta } from "./workbook-meta";
import { parseWorksheet } from "./worksheet";

/** Well-known part paths used by the derivation. */
const PART_PATHS = {
  workbook: "xl/workbook.xml",
  relationships: "xl/_rels/workbook.xml.rels",
  sharedStrings: "xl/sharedStrings.xml",
  styles: "xl/styles.xml",
} as const;

/** Options of the derivation. */
export interface DeriveOptions {
  /** Formula codec; defaults to the one exposed by `@suture/formula`. */
  codec?: FormulaCodec;
}

/** Derives the canonical view of a workbook from its OOXML parts. */
export function deriveCanonical(parts: OoxmlParts, options: DeriveOptions = {}): CanonicalWorkbook {
  const normalized = normalizeParts(parts);
  const codec = options.codec ?? resolveFormulaCodec();
  const workbookXml = readPart(normalized, PART_PATHS.workbook);
  const relationships = parseRelationships(
    readPart(normalized, PART_PATHS.relationships) ?? "<Relationships/>",
  );
  const meta = parseWorkbookMeta(workbookXml, relationships);
  const sharedStrings = parseSharedStrings(readPart(normalized, PART_PATHS.sharedStrings) ?? "<sst/>");
  const formats = parseStyles(readPart(normalized, PART_PATHS.styles) ?? "<styleSheet/>");
  const sheets = meta.sheets.map((sheet) => ({
    meta: sheet,
    cells: parseWorksheet(readPart(normalized, sheet.path) ?? "<worksheet/>", {
      sharedStrings,
      formats,
      converter: codec,
    }),
  }));
  const ordered = [...sheets].sort((a, b) => a.meta.order - b.meta.order);
  return {
    meta: { sheets: ordered.map((sheet) => sheet.meta), definedNames: meta.definedNames },
    sheets: ordered,
  };
}

/**
 * Normalises the parts of an archive: sorted by path, Suture's own document
 * properties stripped. Two archives with the same parts in a different order
 * normalise to the very same map.
 */
export function normalizeParts(parts: OoxmlParts): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of sortParts(parts)) {
    map.set(part.path, decodePart(part));
  }
  const custom = map.get(CUSTOM_PROPERTIES_PART_PATH);
  if (custom !== undefined) {
    const stripped = stripSutureProperties(custom);
    if (stripped === undefined) map.delete(CUSTOM_PROPERTIES_PART_PATH);
    else map.set(CUSTOM_PROPERTIES_PART_PATH, stripped);
  }
  return map;
}

/** Decodes a part into text; binary parts are kept as an empty string. */
function decodePart(part: OoxmlPart): string {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(part.data);
  } catch {
    return "";
  }
}

/** Reads a part by path, tolerating a slightly different folder layout. */
function readPart(parts: Map<string, string>, path: string): string | undefined {
  const exact = parts.get(path);
  if (exact !== undefined) return exact;
  const suffix = `/${path.split("/").pop() ?? path}`;
  for (const [candidate, content] of parts) {
    if (candidate.endsWith(suffix)) return content;
  }
  return undefined;
}
