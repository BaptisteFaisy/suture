/**
 * Variants of the canonical workbook used by the comparison steps.
 *
 * Both variants are built ONCE, before the measured passes: building them is
 * preparation, not measurement. They reuse the address helpers exported by
 * `@suture/canonical` — no duplicated reference parsing.
 */
import { cellRefSortKey, formatCellRef, parseCellRef } from "@suture/canonical";

/** Total number of non-empty cells of a canonical workbook. */
export function cellCount(canonical) {
  return canonical.sheets.reduce((total, sheet) => total + sheet.cells.length, 0);
}

/** Rewrites one cell so the diff engine sees a real change. */
function perturb(record) {
  if (record.kind === "n") return { ...record, input: String(Number(record.input) + 1) };
  if (record.kind === "s") return { ...record, input: `${record.input} (revu)` };
  if (record.kind === "f") return { ...record, cached: String(Number(record.cached) + 1) };
  if (record.kind === "b") return { ...record, input: record.input === "TRUE" ? "FALSE" : "TRUE" };
  return { ...record, input: `${record.input}!` };
}

/** Remplace la première feuille en gardant les autres intactes. */
function withFirstSheet(canonical, cells) {
  const sheets = canonical.sheets.map((sheet, index) => (index === 0 ? { ...sheet, cells } : sheet));
  return { ...canonical, sheets };
}

/** Variant "few cells": about `count` cells of the first sheet are retyped. */
export function withChangedCells(canonical, count = 50) {
  const sheet = canonical.sheets[0];
  const step = Math.max(1, Math.floor(sheet.cells.length / count));
  const cells = sheet.cells.map((record, index) => (index % step === 0 ? perturb(record) : record));
  return withFirstSheet(canonical, cells);
}

/** Shifts every cell at or below `atRow` down by `count` rows. */
function shiftRows(cells, atRow, count) {
  return cells.map((record) => {
    const position = parseCellRef(record.ref);
    if (!position || position.row < atRow) return record;
    return { ...record, ref: formatCellRef({ row: position.row + count, col: position.col }) };
  });
}

/** Builds `count` inserted rows of `columns` numeric cells each. */
function insertedCells(atRow, count, columns) {
  const cells = [];
  for (let row = atRow; row < atRow + count; row += 1) {
    for (let col = 1; col <= columns; col += 1) {
      cells.push({ ref: formatCellRef({ row, col }), kind: "n", input: String(row * col), cached: "", fmt: "" });
    }
  }
  return cells;
}

/** Sorts cells by row then column, the canonical order. */
function sortCells(cells) {
  return cells.sort((left, right) => {
    const [leftRow, leftCol] = cellRefSortKey(left.ref);
    const [rightRow, rightCol] = cellRefSortKey(right.ref);
    return leftRow - rightRow || leftCol - rightCol;
  });
}

/** Variant "structural": `count` rows inserted at `atRow`, the rest shifts. */
export function withInsertedRows(canonical, options = {}) {
  const { atRow = 1000, count = 100, columns = 10 } = options;
  const sheet = canonical.sheets[0];
  const shifted = shiftRows(sheet.cells, atRow, count);
  const cells = sortCells([...shifted, ...insertedCells(atRow, count, columns)]);
  return withFirstSheet(canonical, cells);
}

/** Patch request retyping `count` numeric cells of column B (optional step). */
export function buildPatchRequest(canonical, count = 500) {
  const sheet = canonical.sheets[0];
  const sheetId = sheet.meta.sheetId;
  const targets = sheet.cells.filter(
    (record) => record.kind === "n" && parseCellRef(record.ref)?.col === 2,
  );
  const patches = targets.slice(0, count).map((record) => ({
    sheetId,
    ref: record.ref,
    record: { ...record, input: String(Number(record.input) + 1000) },
    source: "A",
  }));
  return { patches, sheetPaths: new Map([[sheetId, sheet.meta.path]]) };
}
