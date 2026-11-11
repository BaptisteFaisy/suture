/**
 * Serialization of one `<c>` element, per cell kind.
 *
 * Rules (see `.kiro/steering/ooxml.md`):
 * - numbers are written in `<v>` with the shortest decimal that reproduces
 *   the value;
 * - texts are written as **inline strings**, so `xl/sharedStrings.xml` is
 *   never touched (SUT-P-10);
 * - formulas are written without their cached value: Excel recalculates;
 * - the style index `s=` of an existing cell is preserved untouched.
 */
import type { CellRecord } from "@suture/contracts";
import { escapeText } from "./xml";

/** The style attribute (`s="12"`) of a cell, kept verbatim. */
export type StyleAttribute = string | undefined;

function styleAttribute(style: StyleAttribute): string {
  return style === undefined ? "" : ` ${style}`;
}

function renderNumber(input: string): string {
  const text = input.trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text)) {
    throw new RangeError(`Not a number: ${input}`);
  }
  const value = Number(text);
  if (!Number.isFinite(value)) throw new RangeError(`Not a finite number: ${input}`);
  return String(value);
}

function renderBoolean(input: string): string {
  const text = input.trim().toLowerCase();
  if (["1", "true", "vrai"].includes(text)) return "1";
  if (["0", "false", "faux"].includes(text)) return "0";
  throw new RangeError(`Not a boolean: ${input}`);
}

/**
 * Renders the `<c>` element of one cell.
 *
 * @param ref        A1 address of the cell.
 * @param record     Canonical content of the cell.
 * @param style      Raw `s="…"` attribute of the cell being replaced.
 * @param formula    Formula text in A1 notation, without the leading `=`.
 */
export function renderCell(
  ref: string,
  record: CellRecord,
  style: StyleAttribute,
  formula?: string,
): string {
  const s = styleAttribute(style);
  switch (record.kind) {
    case "n":
      return `<c r="${ref}"${s}><v>${renderNumber(record.input)}</v></c>`;
    case "s":
      return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeText(
        record.input,
      )}</t></is></c>`;
    case "b":
      return `<c r="${ref}"${s} t="b"><v>${renderBoolean(record.input)}</v></c>`;
    case "e":
      return `<c r="${ref}"${s} t="e"><v>${escapeText(record.input)}</v></c>`;
    case "f":
      return `<c r="${ref}"${s}><f>${escapeText(formula ?? record.input)}</f></c>`;
    default:
      throw new RangeError(`Unsupported cell kind: ${record.kind}`);
  }
}
