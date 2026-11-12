/**
 * Worksheet parsing (`xl/worksheets/sheetN.xml`).
 *
 * Cells are read in document order but always emitted sorted by (row, column).
 * Shared formulas are expanded: the master is translated to each follower with
 * `shiftA1`, then converted to L1C1 relative to the follower cell.
 */
import type { CellKind, CellRecord } from "@suture/contracts";
import { cellRefSortKey, parseCellRef } from "./refs";
import { canonicalFormat, GENERAL_FORMAT } from "./styles";
import { childrenNamed, collectText, parseXml, type XmlElement } from "./xml";
import type { FormulaCodec } from "./formula-codec";

/** Everything the worksheet parser needs from the other parts. */
export interface WorksheetContext {
  sharedStrings: string[];
  /** Number format code of every cell format index. */
  formats: string[];
  converter: FormulaCodec;
}

/** A shared formula master: its A1 text and the cell that holds it. */
interface SharedMaster {
  formula: string;
  row: number;
  col: number;
}

/** Raw value of a cell, before it is turned into a `CellRecord`. */
interface RawCell {
  ref: string;
  kind: CellKind;
  input: string;
  cached: string;
  fmt: string;
  /** Index of the shared formula group, when the cell belongs to one. */
  sharedIndex?: string;
  /** True when the cell carries the text of its shared formula group. */
  isSharedMaster: boolean;
}

/** Parses a worksheet part into canonical cells (sorted, style-only omitted). */
export function parseWorksheet(xml: string, context: WorksheetContext): CellRecord[] {
  const root = parseXml(xml);
  const sheetData = childrenNamed(root, "sheetdata")[0];
  if (!sheetData) return [];
  const masters = new Map<string, SharedMaster>();
  const raw = collectCells(sheetData, context, masters);
  const records: CellRecord[] = [];
  for (const cell of raw) {
    const record = resolveCell(cell, masters, context);
    if (record !== undefined) records.push(record);
  }
  return records.sort((a, b) => compareRefs(a.ref, b.ref));
}

/** Numeric comparison of two cell references (row first, then column). */
function compareRefs(a: string, b: string): number {
  const [rowA, colA] = cellRefSortKey(a);
  const [rowB, colB] = cellRefSortKey(b);
  if (rowA !== rowB) return rowA - rowB;
  return colA - colB;
}

/** Collects the raw cells of a sheet, remembering shared formula masters. */
function collectCells(
  sheetData: XmlElement,
  context: WorksheetContext,
  masters: Map<string, SharedMaster>,
): RawCell[] {
  const cells: RawCell[] = [];
  for (const row of childrenNamed(sheetData, "row")) {
    for (const cell of childrenNamed(row, "c")) {
      const collected = collectCell(cell, context, masters);
      if (collected !== undefined) cells.push(collected);
    }
  }
  return cells;
}

/** Reads one `<c>` element; `undefined` for style-only cells. */
function collectCell(
  cell: XmlElement,
  context: WorksheetContext,
  masters: Map<string, SharedMaster>,
): RawCell | undefined {
  const ref = cell.attrs["r"];
  if (ref === undefined) return undefined;
  const type = cell.attrs["t"];
  const fmt = formatOf(context, cell.attrs["s"]);
  const formula = childElement(cell, "f");
  const value = childElement(cell, "v");
  if (formula !== undefined) {
    return collectFormulaCell(ref, formula, value, fmt, masters);
  }
  if (value === undefined && childElement(cell, "is") === undefined) return undefined;
  const literal = readLiteral(cell, type, value, context);
  if (literal === undefined) return undefined;
  return { ref, kind: literal.kind, input: literal.input, cached: "", fmt, isSharedMaster: false };
}

/** Reads the `<f>` element of a formula cell. */
function collectFormulaCell(
  ref: string,
  formula: XmlElement,
  value: XmlElement | undefined,
  fmt: string,
  masters: Map<string, SharedMaster>,
): RawCell {
  const si = formula.attrs["si"];
  const text = formula.text.trim();
  const isShared = formula.attrs["t"] === "shared" && si !== undefined;
  if (isShared && text !== "") {
    const position = parseCellRef(ref);
    if (position) masters.set(si, { formula: text, row: position.row, col: position.col });
  }
  return {
    ref,
    kind: "f",
    input: text,
    cached: value?.text ?? "",
    fmt,
    ...(si === undefined ? {} : { sharedIndex: si }),
    isSharedMaster: isShared && text !== "",
  };
}

/** Reads the literal value of a non-formula cell. */
function readLiteral(
  cell: XmlElement,
  type: string | undefined,
  value: XmlElement | undefined,
  context: WorksheetContext,
): { kind: CellKind; input: string } | undefined {
  if (type === "s") {
    const index = Number(value?.text ?? "");
    const text = context.sharedStrings[index];
    if (text === undefined) return undefined;
    return { kind: "s", input: text };
  }
  if (type === "inlineStr") {
    const inline = childElement(cell, "is");
    return { kind: "s", input: inline === undefined ? "" : collectText(inline) };
  }
  if (type === "str") {
    return { kind: "s", input: value?.text ?? "" };
  }
  if (type === "b") {
    const raw = (value?.text ?? "").trim();
    if (raw === "1" || raw.toLowerCase() === "true") return { kind: "b", input: "TRUE" };
    if (raw === "0" || raw.toLowerCase() === "false") return { kind: "b", input: "FALSE" };
    return { kind: "b", input: raw };
  }
  if (type === "e") {
    return { kind: "e", input: value?.text ?? "" };
  }
  if (type === "d") {
    return { kind: "s", input: value?.text ?? "" };
  }
  const raw = (value?.text ?? "").trim();
  if (raw === "") return undefined;
  return { kind: "n", input: formatNumber(raw) };
}

/** Formats a number in its shortest decimal form that round-trips exactly. */
export function formatNumber(raw: string): string {
  const value = Number(raw);
  if (!Number.isFinite(value)) return raw;
  if (Object.is(value, -0)) return "0";
  return String(value);
}

/** Resolves a raw cell into a `CellRecord`, expanding shared formulas. */
function resolveCell(
  cell: RawCell,
  masters: Map<string, SharedMaster>,
  context: WorksheetContext,
): CellRecord | undefined {
  if (cell.kind !== "f") {
    if (cell.input === "") return undefined;
    return { ref: cell.ref, kind: cell.kind, input: cell.input, cached: "", fmt: cell.fmt };
  }
  const input = expandFormula(cell, masters, context);
  if (input === undefined) return undefined;
  return { ref: cell.ref, kind: "f", input, cached: cell.cached, fmt: cell.fmt };
}

/** Expands a formula (possibly shared) into its L1C1 form for that cell. */
function expandFormula(
  cell: RawCell,
  masters: Map<string, SharedMaster>,
  context: WorksheetCodecContext,
): string | undefined {
  const position = parseCellRef(cell.ref);
  if (!position) return undefined;
  if (cell.sharedIndex === undefined) {
    return toR1c1(context.converter, cell.input, position);
  }
  const master = masters.get(cell.sharedIndex);
  if (master === undefined) {
    return cell.isSharedMaster ? toR1c1(context.converter, cell.input, position) : undefined;
  }
  const shifted = context.converter.shiftA1(
    withEquals(master.formula),
    position.row - master.row,
    position.col - master.col,
  );
  return toR1c1(context.converter, shifted.formula, position);
}

/** The subset of the context the expansion needs. */
type WorksheetCodecContext = Pick<WorksheetContext, "converter">;

/** Converts an A1 formula to its L1C1 form, with a leading `=`. */
function toR1c1(
  converter: FormulaCodec,
  formula: string,
  position: { row: number; col: number },
): string | undefined {
  if (formula === "") return undefined;
  const converted = converter.a1ToR1c1(withEquals(formula), position).formula;
  if (converted === "") return undefined;
  return withEquals(converted);
}

/** Adds the leading `=` of a formula, which the codec expects. */
function withEquals(formula: string): string {
  return formula.startsWith("=") ? formula : `=${formula}`;
}

/** Number format of a cell, from its style index (`""` for the general one). */
function formatOf(context: WorksheetContext, styleIndex: string | undefined): string {
  const index = styleIndex === undefined ? undefined : Number(styleIndex);
  const code = index === undefined || !Number.isFinite(index) ? undefined : context.formats[index];
  return canonicalFormat(code ?? GENERAL_FORMAT);
}

/** First direct child with the given local name. */
function childElement(element: XmlElement, name: string): XmlElement | undefined {
  return element.children.find((child) => child.name === name);
}
