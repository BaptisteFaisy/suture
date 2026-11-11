import type { FormulaIssue } from "@suture/contracts";

/**
 * A formula we cannot translate faithfully is never rewritten: it is returned
 * as it is, with an issue so the caller can flag the cell as "to review".
 * Unbalanced parentheses are the detectable case of a broken formula.
 */
export function syntaxIssues(formula: string): FormulaIssue[] {
  let depth = 0;
  for (const char of formula) {
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    if (depth < 0) break;
  }
  if (depth === 0) {
    return [];
  }
  return [
    {
      code: "unsupported-syntax",
      message: "The formula is not balanced; it is kept exactly as it is.",
    },
  ];
}
