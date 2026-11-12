/**
 * @suture/formula — A1 ↔ R1C1 conversion and reference shifting.
 * Implements the `FormulaCodec` contract from `@suture/contracts`.
 *
 * Notation (documented choice, consistent both ways):
 * - both parts relative: zero offset renders as a bare letter — `RC`,
 *   `R[-1]C`, `RC[2]`;
 * - row absolute, column relative: `R5C[2]`;
 * - row relative, column absolute: `R[-1]C7`;
 * - both absolute: `R5C7`.
 *
 * String literals, quoted sheet names, external workbook references and
 * structured table references are protected: they are never rewritten. An
 * external reference adds a `FormulaIssue` so the caller can flag the cell.
 */
import type { FormulaCodec } from "@suture/contracts";
import { a1ToR1c1 } from "./a1-r1c1";
import { r1c1ToA1 } from "./r1c1-a1";
import { formatRef, parseRef } from "./refs";
import { shiftA1 } from "./shift";

export { a1ToR1c1 } from "./a1-r1c1";
export { r1c1ToA1 } from "./r1c1-a1";
export { shiftA1 } from "./shift";
export {
  columnToNumber,
  formatRef,
  formatRefToken,
  numberToColumn,
  parseRef,
  parseRefToken,
} from "./refs";
export type { RefToken } from "./refs";

/** The codec as a single object, for callers that prefer dependency injection. */
export const formulaCodec: FormulaCodec = {
  parseRef,
  formatRef,
  a1ToR1c1,
  r1c1ToA1,
  shiftA1,
};

export const packageName = "@suture/formula";
