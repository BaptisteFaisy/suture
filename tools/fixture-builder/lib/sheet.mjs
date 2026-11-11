/**
 * Worksheet part — the grid itself.
 *
 * Handles the two string flavours of OOXML (shared table or inline) and the
 * three formula flavours (plain, shared master, shared follower).
 */
import { escapeXml, formatNumber, splitRef, textNode, XML_DECLARATION } from "./xml.mjs";

/** 1-based column index of a column letter sequence. */
function columnNumber(letters) {
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index;
}

/** Sorts cells by row then column, and groups them per row. */
export function groupRows(cells) {
  const sorted = [...cells].sort((a, b) => {
    const left = splitRef(a.ref);
    const right = splitRef(b.ref);
    if (left.row !== right.row) return left.row - right.row;
    return columnNumber(left.column) - columnNumber(right.column);
  });
  const rows = new Map();
  for (const cell of sorted) {
    const { row } = splitRef(cell.ref);
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row).push(cell);
  }
  return [...rows.entries()].map(([row, rowCells]) => ({ row, cells: rowCells }));
}

/** Builds the `s="..."` attribute of a cell, empty when the style is General. */
function styleAttribute(cell, context) {
  if (!cell.format) return "";
  const index = context.styleIndex.get(cell.format);
  return index === undefined ? "" : ` s="${index}"`;
}

/** Builds the `<c>` element of one cell. */
function buildCellContent(cell, context) {
  const style = styleAttribute(cell, context);
  if (cell.kind === "f") return buildFormulaCell(cell, context, style);
  if (cell.kind === "b") {
    return `<c r="${cell.ref}"${style} t="b"><v>${cell.value ? 1 : 0}</v></c>`;
  }
  if (cell.kind === "e") {
    return `<c r="${cell.ref}"${style} t="e"><v>${escapeXml(cell.value)}</v></c>`;
  }
  if (cell.kind === "n") {
    return `<c r="${cell.ref}"${style}><v>${formatNumber(cell.value)}</v></c>`;
  }
  if (cell.kind === "blank") {
    // Style-only cell: the style must survive, the value is absent.
    return cell.format ? `<c r="${cell.ref}"${style}/>` : "";
  }
  return buildStringCell(cell, context, style);
}

/** Builds a string cell, shared or inline depending on the options. */
function buildStringCell(cell, context, style) {
  if (context.sharedStrings) {
    const index = context.sharedStringIndex(cell.value);
    return `<c r="${cell.ref}"${style} t="s"><v>${index}</v></c>`;
  }
  return `<c r="${cell.ref}"${style} t="inlineStr"><is>${textNode(cell.value)}</is></c>`;
}

/** Builds a formula cell: plain, shared master or shared follower. */
function buildFormulaCell(cell, context, style) {
  const shared = cell.shared;
  const attributes = shared
    ? ` t="shared"${shared.master ? ` ref="${shared.ref}"` : ""} si="${shared.si}"`
    : "";
  const body = shared && !shared.master ? "" : escapeXml(cell.formula ?? "");
  const cached = cell.cached;
  const hasCached = cached !== null && cached !== undefined;
  const type = hasCached && typeof cached === "boolean" ? ' t="b"' : "";
  const value = hasCached ? `<v>${escapeXml(String(cached))}</v>` : "";
  return `<c r="${cell.ref}"${style}${type}><f${attributes}>${body}</f>${value}</c>`;
}

/** Builds one `<row>` element. */
function buildRow(row, context) {
  const cells = row.cells.map((cell) => buildCellContent(cell, context)).join("");
  return `<row r="${row.row}">${cells}</row>`;
}

/** Computes the `A1:B2` range covering every cell of the sheet. */
function dimensionRefText(rows) {
  if (rows.length === 0) return "A1";
  let first = null;
  let last = null;
  for (const row of rows) {
    for (const cell of row.cells) {
      const { column } = splitRef(cell.ref);
      const position = { column: columnNumber(column), row: row.row };
      if (!first || position.row < first.row || (position.row === first.row && position.column < first.column)) {
        first = position;
      }
      if (!last || position.row > last.row || (position.row === last.row && position.column > last.column)) {
        last = position;
      }
    }
  }
  const name = (position) => {
    let letters = "";
    let remaining = position.column;
    while (remaining > 0) {
      const rest = (remaining - 1) % 26;
      letters = String.fromCharCode(65 + rest) + letters;
      remaining = Math.floor((remaining - 1) / 26);
    }
    return `${letters}${position.row}`;
  };
  return `${name(first)}:${name(last)}`;
}

/**
 * Builds `xl/worksheets/sheetN.xml`.
 *
 * `context.sharedStringIndex` resolves a text to its index in the shared
 * string table; `context.sharedStrings` tells whether that table is used;
 * `context.styleIndex` maps a number-format code to its cell style index.
 */
export function buildSheet(sheet, context) {
  const rows = groupRows(sheet.cells);
  const body = rows.map((row) => buildRow(row, context)).join("");
  const sheetData = rows.length ? `<sheetData>${body}</sheetData>` : "<sheetData/>";
  const drawing = context.withDrawing ? '<drawing r:id="rId1"/>' : "";
  const xml =
    `${XML_DECLARATION}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"` +
    ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<dimension ref="${dimensionRefText(rows)}"/>${sheetData}${drawing}</worksheet>`;
  return xml;
}
