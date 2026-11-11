# Requirements: formula-r1c1

## Introduction

`@suture/formula` (`packages/formula`) provides deterministic, zero-dependency
Excel formula tokenization, `A1 ↔ R1C1` address conversion, and reference
shifting across row/column alignment maps. Because canonical `cells/*.tsv`
files store formulas in R1C1 notation (`=SUM(R[-12]C:R[-1]C)`), inserting rows
above a formula does not create spurious text diffs, and transferring a formula
from one sheet carrier to another during a combine preserves relative semantics
automatically.

`formula-r1c1` is also the **designated benchmark candidate for the "spec-driven
vs vibe coding" comparison** documented in `KIRO_JOURNAL.md` for the Kiroween
2026 submission, because its grammar edge cases (quoted sheet names, mixed `$`
anchors, string literals, structured references, and round-trip invariance) are
uniquely exposed by property-based testing (`SUT-P-03`).

## Personas & User Stories

- **Hugo (management controller)**: Inserts 4 new hire rows above a totals row
  in Excel and expects Suture's comparison to report the 4 inserted rows without
  marking 50 unchanged `SUM` formulas below as edited (`SUT-F-09`).
- **Nadia (volunteer treasurer)**: Combines Paul's new row with Marie's formula
  edits and expects formulas carried from Marie's side to land at the right row
  with accurate relative and shifted absolute references (`SUT-F-18`, `SUT-F-22`).
- **Developer (counter-persona)**: Reads `git log -p -- cells/` and expects clean
  R1C1 formulas in canonical TSV snapshots without corrupted string literals,
  defined names, or structured table references.

## Acceptance Criteria (EARS)

### A1 ↔ R1C1 Conversion & Round-Trip

1. **SUT-P-03 (Round-trip invariance)** — WHEN any valid Excel formula `f` (in
   A1 notation) is converted to R1C1 relative to cell position `pos = { row, col }`
   and converted back via `r1c1ToA1(a1ToR1c1(f, pos), pos)`, the resulting formula
   SHALL be equivalent to `f` (`r1c1ToA1(a1ToR1c1(f, pos), pos) == f` for
   canonical A1 tokens).
2. **Relative, absolute, and mixed coordinates** — WHEN converting an A1
   reference inside `f` at position `(baseRow, baseCol)`:
   - `$A$1` SHALL convert to `R1C1`,
   - `A1` SHALL convert to `R[1 - baseRow]C[1 - baseCol]` (omitting `[0]` as `R` or `C`),
   - `$A1` SHALL convert to `R[1 - baseRow]C1`,
   - `A$1` SHALL convert to `R1C[1 - baseCol]`,
   and `r1c1ToA1` SHALL invert all four anchor forms losslessly.
3. **Ranges, whole-row, and whole-column references** — WHEN `f` contains cell
   ranges (`B2:B13`, `$B$2:D$10`), whole-row ranges (`2:5`, `$2:5`), or
   whole-column ranges (`B:D`, `$B:D`), the system SHALL convert each endpoint
   while preserving range structure and `$` anchors.
4. **Cross-sheet prefixes** — WHEN a reference is prefixed with a sheet name
   (`Summary!B2`, `'Q1 Budget'!$C$4:D10`, `'O''Brien'!A1`), the system SHALL
   preserve the exact sheet prefix (including quotes and escaped apostrophes) and
   convert only the cell/range coordinate suffix.

### Non-Converted Constructs (Preserved Verbatim)

5. **String literals & sheet names** — WHILE scanning a formula, the tokenizer
   SHALL ignore text inside double-quoted string literals (`"B2:B13"`) and
   single-quoted sheet names so strings that look like cell addresses are NEVER
   altered.
6. **Defined names, structured references, and external workbooks** — WHEN a
   formula contains defined names (`TaxRate`, `_rate_2026`), structured table
   references (`Sales[Amount]`, `Sales[[#Headers],[Total]]`), or external
   workbook links (`[Other.xlsx]Sheet1!A1`), the system SHALL leave those tokens
   verbatim without attempting coordinate conversion.
7. **Function names vs cell references** — WHEN a token is immediately followed
   by `(` (such as `LOG10(`, `ATAN2(`, `R1C1(`), the tokenizer SHALL classify it
   as a function call rather than a cell reference.

### Reference Shifting & Safe Fallback

8. **Absolute reference remapping (combine support)** — WHEN shifting a formula
   during a three-way combine (`remapAbsoluteRefs(r1c1Formula, pos, rowMap, colMap)`),
   the system SHALL remap absolute row/column coordinates via the alignment map
   and detect if any range endpoint spans an inserted region, returning a
   `needsVerification: boolean` flag (`SUT-F-21`).
9. **Graceful exotic-formula fallback** — IF a formula cannot be safely parsed
   or produces an out-of-bounds Excel coordinate (`row < 1`, `row > 1_048_576`,
   `col < 1`, `col > 16_384`), THEN the system SHALL return a structured fallback
   result (`{ ok: false, raw: f, needsCheck: true }`) so no formula is ever
   corrupted or silently dropped (`SUT-N-04`, no silent loss).
10. **Zero external dependencies & local execution** — WHILE executing any
    function in `@suture/formula`, the module SHALL use zero third-party runtime
    dependencies (`packages/contracts` only) and perform zero network or I/O calls.
