# Design: diff-engine

## Overview

`packages/diff` implements a pure, deterministic comparison pipeline over two
`CanonicalWorkbook` snapshots:

```
sheet matching (sheetId, then name)
   └─ per matched sheet:
        row signatures (inputs only, no cached values)
        LCS over signatures -> anchors
        half-overlap pairing between anchors -> modified rows
        [optional] column alignment restricted to paired rows
        cell comparison on the aligned grid -> natures
   └─ sheetAdded / sheetRemoved / sheetRenamed
   └─ non-cell parts by SHA-256 fingerprint
=> single typed ChangeSet
```

The `ChangeSet` is consumed by the comparison grid, the deterministic summary,
and `@suture/merge` (which diffs O->A and O->B and intersects the results).

## Data Structures (`@suture/contracts` aligned)

```ts
export type ChangeNature = 'input' | 'consequence' | 'format';

export interface CellChange {
  sheetKey: SheetKey;        // matched sheet identity (sheetId preferred)
  ref: string;               // canonical address on the "other" side grid
  baseRef?: string;          // address on the "base" side when shifted
  nature: ChangeNature;
  base: CanonicalCell | null;   // null when cellAdded
  other: CanonicalCell | null;  // null when cellRemoved
}

export interface RowChange {
  sheetKey: SheetKey;
  kind: 'rowInserted' | 'rowDeleted' | 'rowModified';
  rowIndex: number;          // on the side where the row lives
  pairedRowIndex?: number;   // for rowModified: counterpart on other side
  cells: CanonicalCell[];    // full row content
}

export type ColumnChangeKind = 'colInserted' | 'colDeleted' | 'colModified';

export interface ColumnChange {
  sheetKey: SheetKey;
  kind: ColumnChangeKind;
  colIndex: number;
  pairedColIndex?: number;
}

export interface SheetKey {
  sheetId?: number;
  name: string;
}

export interface SheetChange {
  kind: 'sheetAdded' | 'sheetRemoved' | 'sheetRenamed';
  sheetKey: SheetKey;
  renamedFrom?: string;
}

export interface PartChange {
  partPath: string;                       // e.g. xl/charts/chart2.xml
  kind: 'partChanged' | 'partIdentical';  // fingerprint only, no detail
}

/** Alignment artefacts reused by @suture/merge and @suture/formula. */
export interface SheetAlignment {
  rowMap: Map<number, number>;   // base row -> other row (matched only)
  colMap: Map<number, number>;   // base col -> other col (matched only)
  insertedRows: number[];        // rows only in "other"
  deletedRows: number[];         // rows only in "base"
  insertedCols: number[];
  deletedCols: number[];
  structuralDivergence: boolean; // true when alignment is ambiguous (see Case 4 support in merge)
}

export interface SheetDiff {
  sheetKey: SheetKey;
  alignment: SheetAlignment;
  rows: RowChange[];
  columns: ColumnChange[];   // empty unless column alignment enabled
  cells: CellChange[];
}

export interface ChangeSet {
  baseVersionId: string;
  otherVersionId: string;
  sheets: SheetChange[];
  sheetDiffs: SheetDiff[];
  parts: PartChange[];
  summary: ChangeSummary;    // precomputed deterministic counters
}

export interface ChangeSummary {
  modifiedInputs: number;
  computedConsequences: number;
  formatChanges: number;
  rowsInserted: number;
  rowsDeleted: number;
  rowsModified: number;
  cellsAdded: number;
  cellsRemoved: number;
  sheetsAdded: number;
  sheetsRemoved: number;
  sheetsRenamed: number;
  partsChanged: number;
}
```

## Step-by-Step Algorithms

### 1. Sheet Matching

1. Index base sheets by `sheetId` and by `name`; same for other sheets.
2. Pass 1: match by identical `sheetId` (Excel's stable identity).
3. Pass 2: for unmatched sheets, match by identical `name`. If names differ but
   position + content signature strongly overlap (same order index and ≥ 50%
   identical row signatures), record `sheetRenamed` instead of add/remove.
4. Remaining base-only sheets -> `sheetRemoved`; other-only -> `sheetAdded`.
   Emit `SheetChange` records in workbook order (deterministic).

### 2. Row Signature (inputs only)

For a row, build a canonical string from its cells sorted by column:
`col + ':' + kind + ':' + input + ':' + fmt`, joined by `|`. **`cached` is
excluded** — recalculated results must not affect alignment (SUT-F-08 /
SUT-P-05). Hash with FNV-1a 32-bit (fast, dependency-free) plus a collision
list of full signature strings for exact comparisons. Empty rows produce the
empty signature and are ignored as anchors.

### 3. LCS Row Alignment

1. Build signature arrays `S_base[]`, `S_other[]` for non-empty rows.
2. Compute LCS via Hunt–Szymanski / patience-style matching when signature
   multiplicity is low, falling back to classic dynamic programming
   (`O(n*m)` memory-optimized two-row DP) for dense sheets; cap: for sheets
   where `n*m > 4e8` cell-pairs, fall back to anchor-only matching on unique
   signatures (documented approximation, still deterministic).
3. LCS matches become anchors: identical rows. Rows only in base -> `rowDeleted`;
   only in other -> `rowInserted`; both lists sorted ascending.
4. `rowMap`: anchor rows map `baseRow -> otherRow`.

### 4. Modified-Row Pairing Between Anchors

For each gap between consecutive anchors (and before the first / after the last):
1. Let `Db` = base rows in gap, `Do` = other rows in gap.
2. Pair greedily by maximal overlap: for `(db, do)` compute
   `shared = |{ (col, kind, input) equal on both }|` over non-empty cells,
   `total = |nonEmpty(db) ∪ nonEmpty(do)| (by col)`.
   Accept the pair if `2 * shared >= total` (**at least half the cells match**)
   — the conservative threshold that prevents misalignment applying values to
   the wrong row (risk table, B.16).
3. Solve pairing with a simple max-weight greedy (deterministic: iterate base
   rows ascending, pick best-scoring unpaired other row, tie-break by lowest
   index). Paired rows -> `rowModified` with per-cell changes; unpaired base
   rows -> `rowDeleted`; unpaired other rows -> `rowInserted`.
4. If a gap contains structural pairing that cannot be resolved confidently
   (e.g., both sides heavily edited the same region), set
   `alignment.structuralDivergence = true` for merge Case 4 support.

### 5. Column Alignment (priority S, feature-flagged)

Same method transposed: column signatures computed **only over paired rows**,
LCS over column signatures, half-overlap pairing. Produces `colMap`,
`insertedCols`, `deletedCols`. Disabled by default; `SUT-F-10` enables it.

### 6. Cell Comparison on the Aligned Grid

For every paired row (`rowMap` + `rowModified` pairs), iterate the union of
cell addresses:
1. Cell in both, `input` differs (kind/input) -> `CellChange { nature: 'input' }`.
2. Cell in both, `input` equal, `cached` differs -> `nature: 'consequence'`.
3. Cell in both, `input` and `cached` equal, `fmt` differs -> `nature: 'format'`.
4. Cell only in other -> `cellAdded` (represented as `CellChange` with
   `base: null`); only in base -> `cellRemoved` (`other: null`).
5. For formula cells (`kind: 'f'`), comparison uses the **R1C1 `input` text**,
   so a formula that merely shifted with inserted rows compares equal
   (guarantees SUT-P-05). A formula whose R1C1 text changed is an `input`
   change; a formula with same R1C1 text but different `cached` is a
   `consequence`.

Rows inside `rowInserted` / `rowDeleted` records carry their full cell content;
their cells are NOT additionally emitted as `cellAdded` / `cellRemoved`
(single classification, keeps summary counts honest).

### 7. Non-Cell Parts

Compare `nonCellFingerprints` maps: keys present in both with equal SHA-256 ->
`partIdentical`; differing or one-sided -> `partChanged` (path listed, no
detail — SUT-F-15). Sorted by part path.

### 8. Summary & Determinism

Counters in `ChangeSummary` are accumulated during a single pass; change arrays
are emitted in deterministic order (sheet order, then row asc, then col asc,
then part path). No `Set` iteration order or object-key order leaks into
output serialization.

### 9. Performance (SUT-N-03)

- The whole pipeline is synchronous pure functions; the caller runs it in a Web
  Worker. Row signature hashing is `O(cells)`; LCS DP is bounded by the
  `4e8` cap with anchor-only fallback. Target: 200k cells < 3 s.

## Error Handling

- Malformed canonical input (unsorted cells, invalid refs) throws
  `DiffError('MALFORMED_CANONICAL')` at the boundary; canonical derivation is
  responsible for producing valid input, so this indicates an upstream bug, not
  a user error.

## Testing Strategy

- **Unit tests (`diff.test.ts`)**:
  - Sheet rename detection, sheet add/remove, half-overlap row pairing (accept
    at exactly 50%, reject below), consequence vs input vs format natures,
    formula-shift invariance (insert rows above `=SUM(R[-12]C:R[-1]C)`),
    fingerprint-only part reporting, deterministic ordering across runs.
- **Property tests (`diff.prop.test.ts`, fast-check ≥ 100 CI / 1,000 local)**:
  - **SUT-P-04**: synthetic workbook generator (random sheets/rows/values/
    formulas) -> `diffWorkbooks(W, W)` is the empty `ChangeSet` (zero records in
    every array, all counters zero).
  - **SUT-P-05**: generator emits a workbook plus an edit sequence inserting
    `k` random rows (random content, random positions) -> assert exactly `k`
    `rowInserted` changes, `rowsModified == 0` for untouched regions, and **zero
    `nature: 'input'` cell changes** attributable to shifting.
  - Seeds printed on failure and recorded in `KIRO_JOURNAL.md`; every
    counterexample converted into a deterministic regression test.
