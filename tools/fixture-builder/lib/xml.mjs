/**
 * XML helpers shared by every part of the fixture builder.
 * No external dependency: everything here is a pure string transformation.
 */

/** XML declaration used by every part of an OOXML package. */
export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

/** Escapes the five XML entities of a text node or an attribute value. */
export function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Adds `xml:space="preserve"` when the text has significant blanks. */
export function textNode(text) {
  const needsPreserve = /^\s|\s$/.test(text);
  const attrs = needsPreserve ? ' xml:space="preserve"' : "";
  return `<t${attrs}>${escapeXml(text)}</t>`;
}

/** Converts a 1-based column index into its letters (1 -> A, 27 -> AA). */
export function columnName(index) {
  let remaining = index;
  let name = "";
  while (remaining > 0) {
    const rest = (remaining - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return name;
}

/** Converts column letters into a 1-based column index (A -> 1, AA -> 27). */
export function columnIndex(letters) {
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return index;
}

/** Splits "B12" into its column letters and its row number. */
export function splitRef(ref) {
  const match = /^([A-Z]+)([1-9][0-9]*)$/.exec(ref);
  if (!match) return null;
  return { column: match[1], row: Number(match[2]) };
}

/** Formats a row number and a column index back into an A1 reference. */
export function buildRef(row, column) {
  return `${columnName(column)}${row}`;
}

/** Serializes a number the way a spreadsheet stores it (shortest round trip). */
export function formatNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return String(value);
}
