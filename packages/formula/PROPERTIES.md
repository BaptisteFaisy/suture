# PROPERTIES — `@suture/formula`

Record of properties verified with fast-check (≥ 300 runs in unit runs, 100 in CI).
Seeds of discovered counterexamples are noted here, together with the fix.

| Property | Description | Status |
|---|---|---|
| **SUT-P-03** | `r1c1ToA1(a1ToR1c1(formula, pos), pos).formula === formula` for all generated formulas and positions. | Verified (300 runs) |
| **SUT-P-03 (reverse)** | `a1ToR1c1(r1c1ToA1(r1c1, pos), pos).formula === r1c1`. | Verified (300 runs) |
| **Shift by zero** | `shiftA1(formula, 0, 0).formula === formula`. | Verified (300 runs) |
| **Absolute invariance** | Shifting by `(dRow, dCol)` never moves a fully absolute reference `$Col$Row`. | Verified (300 runs) |
| **External references** | An external workbook reference `[Book.xlsx]` is reported if and only if the formula contains one, and the text is preserved verbatim. | Verified (300 runs) |

## Counterexamples and fixes

1. **Counterexample:** `LOG10(A1)` was treated as cell `LOG10` plus row offset.
   **Fix:** The reference scanner checks that the character immediately preceding
   a cell match is not an identifier character (`[A-Za-z0-9_.$]`), and the character
   immediately following is not `(` or an identifier character.
2. **Counterexample:** `Sheet2!C3` had its sheet name rewritten because `Sheet2`
   looked like cell reference `S2` to a loose pattern.
   **Fix:** Added sheet name prefixes `[A-Za-z_][A-Za-z0-9_.]*!` to the protected
   segments, so only the target reference `C3` is scanned.
