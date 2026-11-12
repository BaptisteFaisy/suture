# Design: merge-engine

## Overview

`packages/merge` turns two change sets into an actionable plan, then a patched
carrier file. It is a **pure planning engine**: it never touches bytes itself —
`@suture/ooxml-patch` performs the writes — which keeps the merge logic testable
in memory and keeps fidelity guarantees in one place.

```
O, A, B (canonical)
  │
  ├─ @suture/diff: ΔA = diff(O, A), ΔB = diff(O, B)
  │
  ▼
buildMergePlan(O, A, B)
  ├─ per sheet: classify structural case (1..4)
  ├─ per sheet: choose carrier
  ├─ per cell: three-way rule -> apply | disagree
  ├─ formulas: R1C1 -> A1 at target position, absolute remap, span check
  └─ non-cell parts: carrier wins, other side -> report
  ▼
MergePlan  ──(user resolves disagreements)──▶  applyMergePlan(plan, decisions)
                                                    │
                                                    ▼
                                          MergeResult { patchedCells, report }
```

## Data Structures (`@suture/contracts` aligned)

```ts
export type CarrierSide = 'A' | 'B';
export type StructuralCase = 1 | 2 | 3 | 4;

export interface CellWrite {
  sheetKey: SheetKey;
  ref: string;                 // target address in the carrier grid
  kind: CellKind;
  input: string;               // literal value or R1C1 formula
  fmt: string;                 // number format code ("" = General)
  origin: 'A' | 'B' | 'user';
  toVerify?: boolean;          // range spans an inserted region
}

export interface Disagreement {
  id: string;                  // deterministic: sheetKey + ref
  sheetKey: SheetKey;
  ref: string;
  base: CanonicalCell | null;
  mine: CanonicalCell | null;      // side A
  theirs: CanonicalCell | null;    // side B
}

export type DisagreementResolution =
  | { kind: 'pickA' }
  | { kind: 'pickB' }
  | { kind: 'custom'; cell: CanonicalCell };

export interface SheetPlan {
  sheetKey: SheetKey;
  structuralCase: StructuralCase;
  carrier: CarrierSide;         // Case 4: user choice, resolved before apply
  writes: CellWrite[];          // automatic applications
  disagreements: Disagreement[];
  rowOps: RowOp[];              // structural operations carried from the carrier side
  colOps: ColOp[];
}

export interface MergePlan {
  originVersionId: string;
  sideA: string;
  sideB: string;
  sheets: SheetPlan[];
  sheetLevelDisagreements: SheetDisagreement[];   // add/remove/rename collisions
  notCarried: ReportEntry[];                      // pre-filled: non-cell parts, Case 4 losers
  toVerify: ReportEntry[];
}

export interface ReportEntry {
  sheetKey?: SheetKey;
  ref?: string;
  partPath?: string;
  reason: 'NON_CELL_PART' | 'SAFE_FALLBACK' | 'RANGE_SPANS_INSERT' | 'SHEET_OP_CONFLICT';
  detail: string;               // plain-language, jargon-free
}

export interface MergeResult {
  plan: MergePlan;
  resolutions: Map<string, DisagreementResolution>;  // disagreement id -> decision
  writes: CellWrite[];                               // final writes incl. resolved
  report: CombineReport;
}

export interface CombineReport {
  applied: ReportEntry[];
  decided: ReportEntry[];
  notCarried: ReportEntry[];
  toVerify: ReportEntry[];
  counts: { applied: number; decided: number; notCarried: number; toVerify: number };
}
```

## Step-by-Step Algorithms

### 1. Structural Classification (per matched sheet)

Given `alignmentA` (from `diff(O, A)`) and `alignmentB` (from `diff(O, B)`):

1. `structA = hasStructuralOps(ΔA)` (any `rowInserted`/`rowDeleted`/`col*`),
   `structB` likewise.
2. `!structA && !structB` -> **Case 1**, carrier `A`.
3. `structA !== structB` -> **Case 2**, carrier = the side with structural ops.
4. `structA && structB` -> compare normalized structural signatures (ordered list
   of `(kind, index, contentSignature)`):
   - identical -> **Case 3**, carrier `A`, reduced to Case 1 on the aligned grid;
   - different, or either alignment has `structuralDivergence` -> **Case 4**:
     no automatic merge, `carrier` left for user choice, both sides' changes go
     to `notCarried` for the non-chosen side.

### 2. Carrier Choice

- Case 1/3 -> `A`; Case 2 -> the restructuring side; Case 4 -> user (blocking
  decision surfaced in the wizard, `SUT-F-20`).

### 3. Per-Cell Three-Way Rule (Cases 1–3)

For each address in the carrier grid, with `o`, `a`, `b` the canonical cells:

1. Normalize each side to a comparable tuple `(kind, input, fmt)` — R1C1 `input`
   for formulas, so shifted formulas compare equal.
2. If `a == b` (both changed identically, or both unchanged): take it.
   - `a == b == o` -> nothing to do.
   - `a == b != o` -> `CellWrite { origin: 'A' }`.
3. If `a == o` and `b != o` -> `CellWrite { origin: 'B' }` (only B changed).
4. If `b == o` and `a != o` -> `CellWrite { origin: 'A' }` (only A changed).
5. If `a != o && b != o && a != b` -> `Disagreement { base: o, mine: a, theirs: b }`.
   The address is **not** written until resolved.
6. If only one side has a cell at that address (added/removed) -> treat the
   absent side as "unchanged/absent"; a cell added by one side only is written;
   a cell removed by one side only is removed (encoded as a `CellWrite` with
   `kind` of the removed cell plus an explicit delete marker in `rowOps`/write
   list — patch layer interprets removal).

Ordering: iterate sheets in workbook order, rows ascending, columns ascending —
output arrays are deterministic (`SUT-P-09` symmetry relies on value-based, not
side-order-based, decisions).

### 4. Formula Transfer (`@suture/formula`)

For a `CellWrite` whose `kind === 'f'` coming from the **non-carrier** side:

1. `input` is R1C1 stored relative to its position in the source sheet.
2. Call `remapAndToA1(r1c1Formula, targetPos, rowMap, colMap)`:
   - relative offsets resolve around the **target** position in the carrier
     (this is exactly why R1C1 is stored — no manual shifting),
   - absolute coordinates are remapped through the alignment maps,
   - a deleted absolute target -> `#REF!` + `toVerify` report entry.
3. If any range endpoint spans a region inserted on the carrier side, set
   `toVerify = true` and add a `RANGE_SPANS_INSERT` report entry.
4. If conversion fails (exotic construct), keep the original formula text, set
   `toVerify = true` (risk table B.16: never corrupt, always flag).

### 5. Sheet-Level Operations

- Added sheet (one side only) -> carried with all its cells.
- Removed sheet (one side only) -> removal carried.
- Renamed sheet -> carry rename.
- Incompatible operations on the same sheet (removed by A, edited by B) ->
  `SheetDisagreement` for user decision; the loser's changes go to
  `notCarried`.

### 6. Non-Cell Parts

- Carrier's parts always win (they are literally copied by the patch layer).
- For each `PartChange` in the non-carrier's `Δ`, add
  `notCarried { reason: 'NON_CELL_PART', detail: '<Part> modified by <side>: not carried over' }`.
- `SUT-F-15` compatibility: no detail beyond the part path and the plain
  sentence.

### 7. `applyMergePlan(plan, resolutions)`

1. Assert every `Disagreement` in every `SheetPlan` has a resolution
   (`SUT-F-19`: unresolved -> throw `MergeError('UNRESOLVED_DISAGREEMENT')`).
2. Materialize resolved cells into `CellWrite`s (`origin: 'user'` for custom).
3. Build the final write list per sheet, sorted deterministically.
4. Build `CombineReport` by partitioning: `applied` (automatic writes),
   `decided` (resolved disagreements), `notCarried` (Case 4 losers, non-cell
   parts, sheet conflicts), `toVerify` (formula ranges, fallbacks).
5. Return `MergeResult`; the caller hands `writes` to `@suture/ooxml-patch` and
   the report to the UI / version note (`SUT-F-21`).

### 8. No Silent Loss Accounting (SUT-P-08)

Before returning, run an internal audit:

1. Build the multiset of change identities from `ΔA ∪ ΔB`
   (`(sheetKey, ref, nature)` for cells; `(sheetKey, rowIndex, kind)` for rows;
   `partPath` for parts; sheet keys for sheet ops).
2. Build the multiset covered by `writes ∪ decided ∪ notCarried ∪ toVerify`
   (a `toVerify` entry also counts as applied when the write happened).
3. Assert equality. Any residue -> throw `MergeError('SILENT_LOSS', {missing})`
   in development and in tests; in production, append the residue to
   `notCarried` with `reason: 'SAFE_FALLBACK'` so the invariant holds by
   construction and the user still sees it.

The audit is the implementation of the invariant and the target of `SUT-P-08`.

## Error Handling

`MergeError` codes: `UNRESOLVED_DISAGREEMENT`, `SILENT_LOSS`,
`MISSING_CARRIER`, `INCOMPATIBLE_SHEET_OP`, `FORMULA_CONVERSION_FAILED`
(non-fatal, downgraded to `toVerify`). All messages are plain-language and go
through the UI vocabulary guard (`product.md`).

## Testing Strategy

- **Unit tests (`merge.test.ts`)**:
  - Each structural case with a hand-built fixture (including Case 4 refusal and
    carrier selection).
  - Disagreement detection, resolution by A/B/custom, save blocked while open.
  - Formula transfer: `=SUM(B2:B13)` written in B14 on side B lands correctly in
    a carrier where 3 rows were inserted above; absolute `$B$2` remapped; range
    spanning an insert flagged `toVerify`.
  - Report partitioning and plain-language sentences; non-cell part on the
    non-carrier side lands in `notCarried`.
  - Two-way degraded mode (no origin) produces one disagreement per difference.
- **Property tests (`merge.prop.test.ts`, fast-check ≥ 100 CI / 1,000 local)**,
  generators shared with `@suture/diff` (synthetic workbooks + edit sequences):
  - **SUT-P-06**: identity laws — `combine(O, A, O)` equals `A` cell-wise,
    `combine(O, O, B)` equals `B`, `combine(O, X, X)` equals `X`.
  - **SUT-P-07**: two disjoint edit sets, no structure change -> zero
    disagreements, all changes applied.
  - **SUT-P-08**: no silent loss — for every generated `(O, A, B)` plus a
    decision strategy that resolves all disagreements, assert the audit passes
    and `ΔA ∪ ΔB ⊆ applied ∪ decided ∪ notCarried`.
  - **SUT-P-09**: symmetry — `combine(O, A, B)` and `combine(O, B, A)` give the
    same cell states with swapped sides.
  - Every counterexample becomes a deterministic regression test and is logged
    in `KIRO_JOURNAL.md` with its seed.
