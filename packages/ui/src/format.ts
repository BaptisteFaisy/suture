/**
 * Locale-aware formatting of cell values and counts — shared by every screen
 * that shows amounts (compare summary, combine report, cell history).
 *
 * Pure: no DOM, no React.
 */

export type UiLang = "en" | "fr";

/** Narrow no-break space used to group thousands (12 000). */
export const GROUP_SEPARATOR = " ";

/** A plain decimal number, with an optional fractional part. */
const PLAIN_NUMBER = /^[-+]?\d+(?:\.\d+)?$/;

/** Groups the integer part by thousands. */
function groupDigits(digits: string): string {
  let out = "";
  for (let i = 0; i < digits.length; i += 1) {
    const remaining = digits.length - i;
    out += digits[i];
    if (remaining > 1 && remaining % 3 === 1) out += GROUP_SEPARATOR;
  }
  return out;
}

/**
 * Formats a decimal number: thousands grouped by a narrow space (the spec
 * writes "120 000 → 131 500" in both languages), decimal separator following
 * the language (comma in French, point in English).
 */
export function formatAmount(value: number, lang: UiLang): string {
  const negative = value < 0;
  const absolute = Math.abs(value);
  const [rawInteger = "0", rawDecimal] = absolute.toString().split(".");
  const integer = groupDigits(rawInteger);
  const decimal =
    rawDecimal === undefined ? "" : lang === "fr" ? "," + rawDecimal : "." + rawDecimal;
  return `${negative ? "-" : ""}${integer}${decimal}`;
}

/**
 * Formats a cell value: a plain number gets grouped and a localized decimal
 * separator; anything else (text, formulas, already-grouped values) is left
 * untouched so that the engine stays the source of truth.
 */
export function formatValue(raw: string, lang: UiLang): string {
  const text = raw.trim();
  if (!PLAIN_NUMBER.test(text)) return raw;
  const value = Number(text);
  if (!Number.isFinite(value)) return raw;
  return formatAmount(value, lang);
}
