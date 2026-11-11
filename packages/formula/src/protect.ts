/**
 * Segments of a formula that must never be rewritten: string literals,
 * external workbook references (quoted or unquoted), sheet prefixes, and
 * structured table references.
 *
 * Each protected segment is replaced by an inert marker built from control
 * characters (U+0001 … U+0002). Those characters never appear in a formula and
 * are not identifier characters, so the reference scanners see a clean
 * boundary where a protected segment used to be.
 */

const OPEN = "\u0001";
const CLOSE = "\u0002";
const TOKEN_PATTERN = new RegExp(`${OPEN}([0-9]+)${CLOSE}`, "g");

const REF_TEXT = String.raw`\$?[A-Za-z]{1,3}\$?[0-9]+`;
const RANGE_TEXT = `${REF_TEXT}(?::${REF_TEXT})?`;

const PROTECTED_PATTERNS: RegExp[] = [
  /"(?:[^"]|"")*"/g,
  new RegExp(String.raw`'(?:[^']|'')*\[[^\]]*\](?:[^']|'')*'!${RANGE_TEXT}`, "g"),
  new RegExp(String.raw`\[[^\]]*\][^\s:!,[\]]*!${RANGE_TEXT}`, "g"),
  /'(?:[^']|'')*'/g,
  // External workbook without a trailing reference: the bracket must hold a
  // file name (a dot and an extension), otherwise an R1C1 offset such as
  // "[-12]" would be swallowed.
  /\[[^\]]*\.[A-Za-z0-9]{1,6}\][^\s:!,[\]]*/g,
  /[A-Za-z_][A-Za-z0-9_.]*!/g,
  // Structured table reference: Table1[Amount]. The bracket must not hold a
  // bare signed number, otherwise an R1C1 offset such as R[-12] would be
  // mistaken for one.
  /[A-Za-z_][A-Za-z0-9_.]*\[(?!\s*-?[0-9]+\s*\])[^\]]*\]/g,
];

export interface ProtectedFormula {
  text: string;
  segments: string[];
  hasExternal: boolean;
}

/** A segment is external when it carries a bracket that is not a table name. */
function isExternalSegment(segment: string): boolean {
  if (!segment.includes("[")) {
    return false;
  }
  return !/^[A-Za-z_][A-Za-z0-9_.]*\[/.test(segment);
}

export function protect(formula: string): ProtectedFormula {
  const segments: string[] = [];
  let text = formula;
  for (const pattern of PROTECTED_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, (match) => {
      segments.push(match);
      return `${OPEN}${segments.length - 1}${CLOSE}`;
    });
  }
  const hasExternal = segments.some(isExternalSegment);
  return { text, segments, hasExternal };
}

export function restore(protectedFormula: ProtectedFormula): string {
  return protectedFormula.text.replace(TOKEN_PATTERN, (_match, index: string) => {
    const segment = protectedFormula.segments[Number(index)];
    return segment === undefined ? "" : segment;
  });
}
