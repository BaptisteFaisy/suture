/**
 * Reading cells back from a worksheet part.
 *
 * Used by the property tests (SUT-P-11) and handy for the combine engine to
 * check what it just wrote. It is a minimal reader: shared strings are not
 * dereferenced (the index is returned), shared formulas are not expanded.
 */
import type { CellKind } from "@suture/contracts";
import { attrValue, elementSource, findElements, unescapeText, type XmlElement } from "./xml";

/** One cell read back from a worksheet part. */
export interface SheetCell {
  /** A1 address. */
  ref: string;
  kind: CellKind;
  /** Typed value: number, text, boolean, error, or formula text. */
  input: string;
  /** Cached value of a formula, empty otherwise. */
  cached: string;
  /** Style index `s="…"`, when present. */
  style: string | undefined;
}

/** Reads every cell of a worksheet part. */
export function readSheetCells(xml: string): SheetCell[] {
  const cells: SheetCell[] = [];
  const sheetData = findElements(xml, "sheetData")[0];
  if (!sheetData) return cells;
  const inner = xml.slice(sheetData.innerStart, sheetData.innerEnd);
  for (const cell of findElements(inner, "c")) {
    const ref = attrValue(cell, "r");
    if (!ref) continue;
    const parsed = parseCell(inner, cell);
    if (parsed) cells.push({ ...parsed, ref });
  }
  return cells;
}

function parseCell(xml: string, cell: XmlElement): Omit<SheetCell, "ref"> | null {
  const style = attrValue(cell, "s");
  const body = xml.slice(cell.innerStart, cell.innerEnd);
  const type = attrValue(cell, "t");
  if (type === "inlineStr") {
    return { kind: "s", input: inlineText(body), cached: "", style };
  }
  const formula = findElements(body, "f")[0];
  const value = findElements(body, "v")[0];
  const cached = value ? textOf(body.slice(value.innerStart, value.innerEnd)) : "";
  if (formula) return { kind: "f", input: formulaText(body, formula), cached, style };
  if (type === "b") return { kind: "b", input: cached === "1" ? "true" : "false", cached: "", style };
  if (type === "e") return { kind: "e", input: cached, cached: "", style };
  if (type === "s") return { kind: "s", input: cached, cached: "", style };
  if (cached !== "") return { kind: "n", input: cached, cached: "", style };
  return null;
}

function formulaText(body: string, formula: XmlElement): string {
  const shared = attrValue(formula, "t") === "shared" || attrValue(formula, "si") !== undefined;
  if (shared && formula.innerStart === formula.innerEnd) return "";
  const text = body.slice(formula.innerStart, formula.innerEnd);
  return unescapeText(text);
}

function inlineText(body: string): string {
  const is = findElements(body, "is")[0];
  if (!is) return "";
  const inner = body.slice(is.innerStart, is.innerEnd);
  return findElements(inner, "t")
    .map((element) => unescapeText(inner.slice(element.innerStart, element.innerEnd)))
    .join("");
}

function textOf(text: string): string {
  return unescapeText(text.replace(/^\s+|\s+$/g, ""));
}

/** Raw source of a cell element, for byte-level assertions in tests. */
export function cellSource(xml: string, ref: string): string | undefined {
  const sheetData = findElements(xml, "sheetData")[0];
  if (!sheetData) return undefined;
  const inner = xml.slice(sheetData.innerStart, sheetData.innerEnd);
  const cell = findElements(inner, "c").find((element) => attrValue(element, "r") === ref);
  return cell ? elementSource(inner, cell) : undefined;
}
