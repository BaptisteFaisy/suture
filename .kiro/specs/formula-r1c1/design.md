# Design: formula-r1c1

## Overview

`@suture/formula` implements a lightweight deterministic scanner and coordinate
transformer for Excel formulas. Instead of building a full formula evaluator
(explicitly a non-goal), it uses a single-pass lexical tokenizer that isolates
string literals, quoted sheet names, structured table brackets, external
workbook prefixes, function identifiers, and A1/R1C1 reference tokens.

This design guarantees that `a1ToR1c1` and `r1c1ToA1` form an exact bijection
over canonical uppercase A1 references and makes `formula-r1c1` clean to compare
against an un-specced "vibe-coded" regex baseline in `KIRO_JOURNAL.md`.

## Data Structures (`@suture/contracts` aligned)

```ts
export const EXCEL_BOUNDS = {
  MAX_ROW: 1_048_576, // 2^20
  MAX_COL: 16_384,    // XFD (2^14)
} as const;

export interface CellPos {
  row: number; // 1-based (1..1_048_576)
  col: number; // 1-based (1..16_384)
}

export type FormulaTokenKind =
  | 'string'          // "..." with "" escapes
  | 'external_ref'    // [Book.xlsx]Sheet1!A1 (kept verbatim)
  | 'structured_ref'  // Table1[[#This Row],[Amount]] (kept verbatim)
  | 'sheet_prefix'    // Sheet1! or 'My Sheet'!
  | 'a1_ref'          // $A$1, B14, $B2, B$14
  | 'r1c1_ref'        // R1C1, R[-2]C, R[1]C[3]
  | 'axis_ref'        // whole-row 2:5 or whole-col B:D (inside range)
  | 'function'        // IDENT(
  | 'name'            // defined name identifier
  | 'other';          // operators, numbers, whitespace, punctuation

export interface FormulaToken {
  kind: FormulaTokenKind;
  raw: string;
}

export interface FormulaConversionResult {
  ok: boolean;
  formula: string;    // Converted string, or original raw string on fallback
  needsCheck: boolean;
  reason?: string;
}

export type IndexMap = Map<number, number>; // old 1-based index -> new 1-based index
```

## Step-by-Step Algorithms

### 1. Address Primitives (`colToLetters`, `lettersToCol`, `parseCellRef`)

- `lettersToCol(letters: string)`: base-26 (`A=1 .. Z=26`, `XFD=16384`),
  case-insensitive input normalized to uppercase. Validate `1 <= col <= MAX_COL`.
- `colToLetters(col: number)`: inverse base-26 conversion.
- `parseCellRef(ref: string)`: splits optional `$`, 1..3 letters `[A-Za-z]{1,3}`,
  optional `$`, digits `[1-9][0-9]*`. Rejects numbers `> MAX_ROW` or columns
  `> MAX_COL` so tokens like `LOG10` or `XFE1` or `2026` are never misread as
  A1 cell coordinates.

### 2. Lexical Tokenizer (`tokenizeFormula(formula: string)`)

Scan left-to-right with index `i`:
1. If `formula[i] === '"'`: consume until closing `"` (treating `""` as escaped
   quote) -> emit `'string'`.
2. If `formula[i] === "'"`: consume single-quoted sheet name (treating `''` as
   escaped apostrophe). If followed by `!` (and not preceded by `[Book]`):
   - If the quoted segment starts with `[` (external workbook like
     `'[Book.xlsx]Sheet 1'!A1`), consume through the trailing cell/range ref as
     `'external_ref'` (verbatim).
   - Otherwise emit `'sheet_prefix'`.
3. If `formula[i] === '['`: check if external workbook link `[Book.xlsx]...` ->
   consume workbook + sheet + trailing ref as `'external_ref'`.
4. Bracketed structured table reference `Ident[...]` (handling nested `[...]`,
   e.g. `Sales[[#Headers],[Amount]]`): consume balanced brackets as
   `'structured_ref'`.
5. Unquoted sheet prefix `Ident!` (`[A-Za-z_][A-Za-z0-9_.]*!`): emit
   `'sheet_prefix'`.
6. Function identifier: identifier immediately followed by `(` -> emit
   `'function'`.
7. R1C1 coordinate token (`R(\[-?\d+\]|\d+)?C(\[-?\d+\]|\d+)?` when not
   preceded/followed by identifier characters) -> emit `'r1c1_ref'`.
8. A1 coordinate token (`\$?[A-Za-z]{1,3}\$?[1-9]\d*` with valid Excel bounds,
   not preceded by `[A-Za-z0-9_.]` and not followed by `[A-Za-z0-9_(]`) -> emit
   `'a1_ref'`.
9. Whole-row / whole-column range patterns (`\$?\d+:\$?\d+` or
   `\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}` bounded correctly) -> emit `'axis_ref'`.
10. Remaining identifier -> emit `'name'`; single char operator/space -> `'other'`.

### 3. `a1ToR1c1(formula: string, pos: CellPos): FormulaConversionResult`

1. If `!formula.startsWith('=')`, return `{ ok: true, formula, needsCheck: false }`.
2. Tokenize `formula.slice(1)`.
3. For each `'a1_ref'` token:
   - Parse `{ colAbs, col, rowAbs, row }`.
   - Format row part: `rowAbs ? 'R' + row : (row === pos.row ? 'R' : 'R[' + (row - pos.row) + ']')`.
   - Format col part: `colAbs ? 'C' + col : (col === pos.col ? 'C' : 'C[' + (col - pos.col) + ']')`.
4. For `'axis_ref'` tokens (e.g. `$2:5` or `B:$D`), convert row-only (`R2:R[3]`)
   or col-only (`C:C4`) endpoints relative to `pos`.
5. Leave `'string'`, `'external_ref'`, `'structured_ref'`, `'sheet_prefix'`,
   `'function'`, `'name'`, `'other'` untouched.
6. Rejoin `'=' + convertedTokens.join('')`.

### 4. `r1c1ToA1(formula: string, pos: CellPos): FormulaConversionResult`

1. Tokenize `formula.slice(1)`.
2. For each `'r1c1_ref'` token:
   - Parse row spec:
     - `R` -> `rowAbs = false, targetRow = pos.row`
     - `R[d]` -> `rowAbs = false, targetRow = pos.row + d`
     - `Rd` -> `rowAbs = true, targetRow = d`
   - Parse col spec identically against `pos.col`.
   - Bounds check: if `targetRow < 1 || targetRow > MAX_ROW || targetCol < 1 || targetCol > MAX_COL`,
     abort and return `{ ok: false, formula, needsCheck: true, reason: 'OUT_OF_BOUNDS' }`.
   - Emit `(colAbs ? '$' : '') + colToLetters(targetCol) + (rowAbs ? '$' : '') + targetRow`.
3. For R1C1 row-only (`R2:R[3]`) or col-only (`C:C4`) axis ranges, invert
   similarly with bounds check.
4. Rejoin `'=' + convertedTokens.join('')`.

### 5. `remapAndToA1(r1c1Formula, targetPos, rowMap, colMap)` (for Combine)

1. Convert R1C1 formula using `pos = targetPos`:
   - Relative `R[d]` / `C[d]` offsets resolve directly around `targetPos` in the
     carrier sheet (no extra shifting needed!).
   - Absolute `Rd` / `Cd` coordinates look up `rowMap.get(d) ?? d` and
     `colMap.get(d) ?? d`. If any referenced absolute row/col was deleted in
     carrier (`rowMap.get(d) === undefined` when `deletedRows.has(d)`), return
     `{ ok: false, formula: r1c1Formula, needsCheck: true, reason: 'DELETED_TARGET' }`
     (or `#REF!` flagged in report).
2. Range-span detection: for any range token `start:end`, compare original
   span `(endRow - startRow)` against mapped span `(mappedEndRow - mappedStartRow)`
   (or check if any inserted row index falls strictly between `mappedStartRow`
   and `mappedEndRow`). If an insertion landed inside the range, set
   `needsCheck = true` so the combine report flags the range for review.

## Error Handling

- Invalid coordinates, unbalanced quotes/brackets, or `#REF!` out-of-bounds
  translations never throw unhandled exceptions inside batch canonical/merge
  pipelines; they return `{ ok: false, formula: input, needsCheck: true, reason }`.

## Testing Strategy

- **Unit tests (`formula.test.ts`)**:
  - All 4 anchor modes (`A1`, `$A1`, `A$1`, `$A$1`) across edge positions (`A1`,
    `Z10`, `XFD1048576`).
  - Quoted sheet names with spaces and `''`, string literals containing `"A1:B2"`,
    functions `LOG10()`, `ATAN2()`, `SUM()`, structured references `Sales[[#This Row],[Net]]`,
    external refs `[Budget.xlsx]Sheet1!$B$2`, defined names `VAT_Rate`.
  - Out-of-bounds fallback (`R[-5]C` at row `2` -> `needsCheck: true`, original
    formula preserved).
  - Range-span detection when rows are inserted inside `SUM(R[-4]C:R[-1]C)`.
- **Property tests (`formula.prop.test.ts` with `fast-check`, ≥ 100 CI / 1,000 local)**:
  - **SUT-P-03**: generate random formula ASTs (nested arithmetic, functions,
    mixed `$` A1 refs, ranges, sheet prefixes, string literals, structured refs,
    defined names) and random valid positions `(row, col)` -> assert
    `r1c1ToA1(a1ToR1c1(f, pos), pos) === canonicalUpper(f)`.
  - Log seeds and any discovered counterexamples in `KIRO_JOURNAL.md` alongside
    the "spec vs vibe coding" comparison notes.
