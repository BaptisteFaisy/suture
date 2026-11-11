
function rebuildSheetData(
  inner: string,
  byRow: Map<number, Map<string, SheetWrite>>,
  expanded: Map<string, string>,
): string {
  const rows = findElements(inner, "row");
  const known = new Set<number>();
  for (const row of rows) {
    const number = Number(attrValue(row, "r") ?? "");
    if (Number.isInteger(number)) known.add(number);
  }
  const missing = [...byRow.keys()].filter((number) => !known.has(number)).sort((a, b) => a - b);
  const pieces: string[] = [];
  let cursor = 0;
  let next = 0;
  for (const row of rows) {
    const number = Number(attrValue(row, "r") ?? "");
    while (next < missing.length && (missing[next] as number) < number) {
      pieces.push(inner.slice(cursor, row.start));
      pieces.push(
        newRow(missing[next] as number, byRow.get(missing[next] as number) as Map<string, SheetWrite>),
      );
      cursor = row.start;
      next += 1;
    }
    pieces.push(inner.slice(cursor, row.start));
    const writes = byRow.get(number);
    const needsWork = writes !== undefined || rowHasExpanded(row, inner, expanded);
    pieces.push(
      needsWork
        ? rebuildRow(inner, row, writes ?? new Map<string, SheetWrite>(), expanded)
        : elementSource(inner, row),
    );
    cursor = row.end;
  }
  pieces.push(inner.slice(cursor));
  while (next < missing.length) {
    const number = missing[next] as number;
    pieces.push(newRow(number, byRow.get(number) as Map<string, SheetWrite>));
    next += 1;
  }
  return pieces.join("");
}

function rowHasExpanded(row: XmlElement, inner: string, expanded: Map<string, string>): boolean {
  if (expanded.size === 0) return false;
  const rowInner = inner.slice(row.innerStart, row.innerEnd);
  return findElements(rowInner, "c").some((cell) => expanded.has(attrValue(cell, "r") ?? ""));
}

function rebuildRow(
  inner: string,
  row: XmlElement,
  writes: Map<string, SheetWrite>,
  expanded: Map<string, string>,
): string {
  const rowInner = inner.slice(row.innerStart, row.innerEnd);
  const { slots, tail } = readSlots(rowInner);
  const final = applyWrites(slots, writes, expanded);
  const body = final.map((slot) => slot.gap + slot.text).join("") + tail;
  const openTag = setSpans(
    inner.slice(row.start, row.innerStart),
    final.map((slot) => slot.col).filter((col) => col > 0),
  );
  if (row.selfClosing) return `${openTag.replace(/\/>$/, "></row>")}`;
  return `${openTag}${body}</row>`;
}

function readSlots(rowInner: string): { slots: CellSlot[]; tail: string } {
  const cells = findElements(rowInner, "c");
  const slots: CellSlot[] = [];
  let cursor = 0;
  for (const cell of cells) {
    const ref = attrValue(cell, "r") ?? "";
    slots.push({
      col: columnOf(ref),
      gap: rowInner.slice(cursor, cell.start),
      text: elementSource(rowInner, cell),
      style: styleOf(cell),
      ref,
    });
    cursor = cell.end;
  }
  return { slots, tail: rowInner.slice(cursor) };
}

function columnOf(ref: string): number {
  if (!ref) return 0;
  try {
    return parseRef(ref).col;
  } catch {
    return 0;
  }
}

function styleOf(cell: XmlElement): string | undefined {
  const found = cell.attrs.find((attr) => attr.name === "s");
  return found ? found.raw : undefined;
}
/**
 * Mutation of one worksheet part.
 *
 * Only the targeted rows are rebuilt: the other rows, the other cells and
 * every byte outside `<sheetData>` are copied verbatim.
 */
import type { CellRecord } from "@suture/contracts";
import { renderCell } from "./cell-xml";
import { PatchError } from "./errors";
import { toSheetFormula } from "./formula-input";
import { formatRef, parseRef } from "./refs";
import { breakSharedGroups, withStandaloneFormula } from "./shared-formula-scan";
import { attrValue, elementSource, findElements, type XmlElement } from "./xml";

/** One cell to write into a sheet. */
export interface SheetWrite {
  /** A1 address in the carrier sheet. */
  ref: string;
  /** New content, or `null` to delete the cell. */
  record: CellRecord | null;
}

/** A cell of a row, with the text that precedes it. */
interface CellSlot {
  /** Column number, 0 when the cell has no usable `r` attribute. */
  col: number;
  /** Text between the previous cell and this one. */
  gap: string;
  /** Rendered source of the cell. */
  text: string;
  /** Style attribute (`s="…"`) of the cell being replaced. */
  style: string | undefined;
  /** Ref of the cell. */
  ref: string;
}

/** Writes the given cells into a sheet XML and returns the new XML. */
export function writeSheet(xml: string, writes: SheetWrite[]): string {
  if (writes.length === 0) return xml;
  const sheetData = findElements(xml, "sheetData")[0];
  if (!sheetData) {
    throw new PatchError("malformed-sheet-xml", "Worksheet has no <sheetData> element.");
  }
  const byRow = groupByRow(writes);
  const patched = new Set(writes.map((write) => write.ref));
  const expanded = breakSharedGroups(xml, patched);
  const inner = sheetData.selfClosing
    ? ""
    : xml.slice(sheetData.innerStart, sheetData.innerEnd);
  const rebuilt = rebuildSheetData(inner, byRow, expanded);
  const body = sheetData.selfClosing
    ? `<sheetData>${rebuilt}</sheetData>`
    : xml.slice(0, sheetData.innerStart) + rebuilt + xml.slice(sheetData.innerEnd);
  return updateDimension(body, writes);
}

function groupByRow(writes: SheetWrite[]): Map<number, Map<string, SheetWrite>> {
  const byRow = new Map<number, Map<string, SheetWrite>>();
  for (const write of writes) {
    const address = parseRef(write.ref);
    const rowWrites = byRow.get(address.row) ?? new Map<string, SheetWrite>();
    if (rowWrites.has(write.ref)) {
      throw new PatchError("duplicate-cell-patch", `Two patches for the same cell ${write.ref}.`);
    }
    rowWrites.set(write.ref, write);
    byRow.set(address.row, rowWrites);
  }
  return byRow;
}

function applyWrites(
  slots: CellSlot[],
  writes: Map<string, SheetWrite>,
  expanded: Map<string, string>,
): CellSlot[] {
  const result: CellSlot[] = [];
  for (const slot of slots) {
    const write = writes.get(slot.ref);
    if (!write) {
      result.push(expandSlot(slot, expanded));
      continue;
    }
    if (write.record === null) continue;
    result.push({ ...slot, text: renderWrite(write, slot.style) });
  }
  for (const [ref, write] of writes) {
    if (slots.some((slot) => slot.ref === ref)) continue;
    if (write.record === null) continue;
    const address = parseRef(ref);
    result.push({
      col: address.col,
      gap: "",
      text: renderWrite(write, undefined),
      style: undefined,
      ref,
    });
  }
  return result.sort((a, b) => a.col - b.col);
}

function expandSlot(slot: CellSlot, expanded: Map<string, string>): CellSlot {
  const formula = expanded.get(slot.ref);
  if (formula === undefined) return slot;
  return { ...slot, text: withStandaloneFormula(slot.text, formula) };
}

function renderWrite(write: SheetWrite, style: string | undefined): string {
  const record = write.record as CellRecord;
  const formula =
    record.kind === "f" ? toSheetFormula(record.input, write.ref) : undefined;
  return renderCell(write.ref, record, style, formula);
}

function setSpans(openTag: string, columns: number[]): string {
  const withoutSpans = openTag.replace(/\s+spans="[^"]*"/, "");
  if (columns.length === 0) return withoutSpans;
  const min = Math.min(...columns);
  const max = Math.max(...columns);
  const selfClosing = withoutSpans.endsWith("/>");
  const body = selfClosing ? withoutSpans.slice(0, -2) : withoutSpans.slice(0, -1);
  const closing = selfClosing ? "/>" : ">";
  return `${body} spans="${min}:${max}"${closing}`;
}

function newRow(number: number, writes: Map<string, SheetWrite>): string {
  const cells = [...writes.entries()]
    .filter(([, write]) => write.record !== null)
    .sort((a, b) => parseRef(a[0]).col - parseRef(b[0]).col)
    .map(([, write]) => renderWrite(write, undefined))
    .join("");
  return `<row r="${number}">${cells}</row>`;
}

/**
 * Widens the `<dimension>` element so it still covers every written cell.
 * Excel tolerates a stale dimension, but a correct one avoids surprises.
 */
function updateDimension(xml: string, writes: SheetWrite[]): string {
  const dimension = findElements(xml, "dimension")[0];
  if (!dimension) return xml;
  const ref = attrValue(dimension, "ref");
  if (!ref || ref.includes(" ")) return xml;
  const ends = ref.split(":");
  let min: { row: number; col: number };
  let max: { row: number; col: number };
  try {
    min = parseRef(ends[0] as string);
    max = parseRef(ends[1] ?? (ends[0] as string));
  } catch {
    return xml;
  }
  for (const write of writes) {
    const address = parseRef(write.ref);
    if (address.row < min.row || (address.row === min.row && address.col < min.col)) min = address;
    if (address.row > max.row || (address.row === max.row && address.col > max.col)) max = address;
  }
  const next = `${formatRef(min)}:${formatRef(max)}`;
  if (next === ref) return xml;
  const raw = xml
    .slice(dimension.start, dimension.end)
    .replace(/ref="[^"]*"/, `ref="${next}"`);
  return xml.slice(0, dimension.start) + raw + xml.slice(dimension.end);
}
