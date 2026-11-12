# PROPERTIES — `@suture/merge`

Properties verified with fast-check, and every counterexample they found.

| Property | Statement | Runs | Status |
|---|---|---|---|
| **SUT-P-06** | `combine(O, A, O)` needs no patch and no decision; `combine(O, O, B)` reproduces B on the carrier; `combine(O, X, X)` needs neither. | 80 × 3 | Verified |
| **SUT-P-07** | Two sides touching disjoint cells never disagree. | 80 | Verified |
| **SUT-P-08** | Every change the other side brought is applied, decided, or listed in the report — never absent. | 80 | Verified |
| **SUT-P-09** | `combine(O, A, B)` and `combine(O, B, A)` give the same disagreements, with their sides swapped (B.13). | 80 | Verified |
| **SUT-F-24** | Two-way mode (no known origin): every address where the two files differ is accounted for — exactly one decision per address, or a report line naming it (address, row, column, sheet); `planTwoWay(X, X)` decides and reports nothing. | 120 × 3 | Verified |

The four structural cases of B.8 are covered by unit tests
(`src/cases.test.ts`): cell-by-cell merge, one side changed the structure
(the other side's change is carried onto the carrier's row), identical
structural changes, and the safe fallback when both sides changed the
structure differently.

## Two-way mode (SUT-F-24, `src/two-way.ts`)

When no common origin is known, none is invented: `planTwoWay(A, B)` compares
the two files and hands **every** difference to the user. Side A carries (it is
the file that gets patched), `patches` stays empty, and each disagreement has
`base: null` — there is no third version to fall back on. What cannot become a
decision is named in the report instead: a sheet, a row or a column only one
side has, a cell whose address the carrier does not have, a sheet name or
visibility that differs, a defined name that differs.

The property (`src/two-way.prop.test.ts`) checks, over 120 runs of three
statements, that for two files drawn from the shared generators — with, half of
the time, a sheet only side B has:

1. every address where the two files differ is accounted for: one decision
   carrying that address, or a report line naming it by address, by row, by
   column or by sheet;
2. no address carries two decisions (identifiers are unique) and none is both
   decided and named by a report line;
3. `planTwoWay(X, X)` yields no decision, no patch and no report line.

Measured over 1 000 runs (one local session): 2 544 differing addresses, all
accounted for — 2 227 by a decision, 97 by a report line naming the address,
442 covered by a structural line (row, column or sheet); the two kinds of
coverage overlap on 222 addresses (a cell of a column only one side has is
named twice: once by its address, once by its column).

## Counterexamples found and fixed

1. **Counterexample:** a cell edited by one side was reported as a *disagreement*
   even when the carrier already held that value.
   **Fix:** the carrier is compared with the incoming value first; the carrier
   wins when it already agrees.
2. **Counterexample:** the other side's changes were mapped with the origin's
   coordinates instead of the carrier's, so a row inserted by one side landed
   the other side's edit on the wrong row.
   **Fix:** the map is composed — *other → origin → carrier* — from the
   alignments of `@suture/diff` (`src/coordinates.ts`). A row that the carrier
   does not have maps to `null`, and the change goes to the report instead of
   vanishing.
3. **Counterexample:** a sheet present on one side only was reported as a
   patch on a sheet that does not exist in the carrier.
   **Fix:** such a sheet is listed in the report as *not carried over* — the
   file is never rebuilt to add it.
4. **Counterexample (found by the property, not by a unit test):** the first
   generators produced *unrelated* workbooks (random sheet identifiers), so
   the properties were meaningless.
   **Fix:** the generators now build a base grid and derive the sides from it
   (`test/generators.ts`), so origin and sides are comparable, as in reality.

## Known limits of this edition

- A formula is carried in R1C1 (position independent) and converted to A1 by
  the patcher when it writes the sheet: this is what makes a carried formula
  land correctly on the carrier's row.
- A change whose row or column disappeared in the carrier cannot be applied
  automatically: it is listed in the report as *not carried over*, with the
  address, so the user can apply it by hand. Nothing disappears silently.
- Two-way mode has no origin to arbitrate the structure: a sheet, a row or a
  column only one side has is never moved automatically — it is named in the
  report, and only the cell differences of the sheets both files have become
  decisions. The decisions are written into side A, the carrier; the existing
  `resolveMerge` applies them unchanged.
