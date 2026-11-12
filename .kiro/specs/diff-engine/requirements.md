# Requirements: diff-engine

## Introduction

`@suture/diff` (`packages/diff`) compares two canonical workbook snapshots
(produced by `@suture/canonical`) and emits a single typed `ChangeSet` that is
the only input to the comparison grid, the deterministic summary, and the
three-way combine in `@suture/merge`. It classifies every difference by
**nature** — modified user input, computed consequence, or format-only change —
aligns inserted/deleted rows (and optionally columns) instead of marking them
as modifications, matches sheets by stable identity, and reduces non-cellular
parts (charts, pivot tables, macros, styles) to fingerprint comparisons.

## Personas & User Stories

- **Nadia (volunteer treasurer)**: Re-imports a colleague's edited workbook and
  sees "3 modified inputs, 1 added row, 14 recalculated results" instead of
  fifty scary cell changes — the recalculated totals are visually recessed
  (`SUT-F-08`, `SUT-F-13`).
- **Hugo (management controller)**: Inserts 6 budget lines mid-sheet in Excel;
  Suture's comparison shows exactly 6 added rows and never flags the shifted
  formulas below as edited (`SUT-F-09`, `SUT-P-05`).
- **Marie/Paul (email correspondents)**: Both changed the same cell differently;
  the change sets must faithfully expose both edits to the combine wizard so no
  change disappears (`SUT-F-18`, `SUT-P-08` upstream requirement).
- **Developer (counter-persona)**: Reads the exported Git history; the derived
  `ChangeSet` must be stable across runs (deterministic) for reproducible
  summaries.

## Acceptance Criteria (EARS)

### Sheet Matching & ChangeSet Shape

1. **SUT-F-11 (Sheet lifecycle)** — WHEN comparing two canonical workbooks, the
   system SHALL match sheets first by `sheetId`, then by `name` for rename
   detection, and SHALL report `sheetAdded`, `sheetRemoved`, and `sheetRenamed`
   changes; matched sheets SHALL be compared cell-wise into the same `ChangeSet`.
2. **Deterministic output** — WHEN `diffWorkbooks(base, other)` runs twice on
   identical inputs, the system SHALL produce an identical `ChangeSet` (stable
   ordering of all change records), suitable for `SUT-F-13` deterministic
   summaries.
3. **SUT-P-04 (Self-comparison is empty)** — WHEN a workbook snapshot is
   compared with itself, the system SHALL return an empty `ChangeSet`
   (`diffWorkbooks(W, W) == emptyChangeSet`).

### Row/Column Alignment

4. **Row signatures without computed values** — WHEN computing each row's
   signature for alignment, the system SHALL hash only user inputs (`kind`,
   `input`, `fmt` of value cells; formula text for `f` cells) and SHALL NOT
   include `cached` results, so recalculation noise cannot break alignment.
5. **LCS row alignment** — WHEN two matched sheets are compared, the system
   SHALL compute the longest common subsequence (LCS) over row signatures to
   identify unchanged, inserted, and deleted rows.
6. **Modified-row pairing between anchors** — WHEN rows lie between two LCS
   anchors on both sides, the system SHALL pair them as `rowModified` candidates
   only if they share at least half of their non-empty cell addresses (by count
   of cells with equal `input`), and SHALL otherwise treat them as deletions +
   insertions.
7. **SUT-F-09 / SUT-P-05 (Insertions are insertions)** — WHEN `k` rows are
   inserted anywhere in a sheet, the system SHALL report exactly `k` row
   insertions and zero modified inputs for the shifted cells below
   (`diff` of a sheet with `k` inserted rows == `k` `rowInserted` changes).
8. **SUT-F-10 (Column alignment, priority S)** — WHERE column alignment is
   enabled, the system SHALL apply the same signature/LCS/half-matching method
   to columns, restricted to paired rows.
9. **Alignment maps for combine** — WHEN row or column alignment runs, the
   system SHALL expose the resulting old-index -> new-index alignment maps
   (`rowMap`, `colMap`, plus inserted/deleted index sets) inside the
   `SheetDiff` so `@suture/merge` and `@suture/formula` can remap absolute
   references.

### Cell-Level Natures

10. **SUT-F-08 (Three natures)** — WHEN comparing paired cells, the system
    SHALL classify each difference into exactly one nature and count them
    separately:
    - `input` differs -> **modified input** (what a person typed),
    - `input` identical but `cached` differs -> **computed consequence**
      (a recalculated result),
    - only `fmt` differs -> **format change** (hidden by default in UI).
11. **Cell lifecycle within paired rows** — WHEN a cell address exists on one
    side only inside a paired row region, the system SHALL report `cellAdded` or
    `cellRemoved` with its full canonical value; an unchanged `cached` SHALL NOT
    produce any change record.

### Non-Cellular Parts

12. **SUT-F-15 (Fingerprint comparison)** — WHEN comparing non-cellular parts
    (charts, pivot tables, macros, styles, media), the system SHALL compare only
    their SHA-256 fingerprints recorded by canonical derivation and report each
    part as `changed` or `identical`, with no cell-level detail.
13. **ChangeSet is the single source** — WHEN the UI grid, summary counters, and
    combine engine consume a comparison, they SHALL read exclusively the typed
    `ChangeSet` produced here; no component SHALL recompute differences itself.

### Non-Functional

14. **SUT-N-03 (Performance)** — WHEN comparing a 200,000-cell workbook, the
    system SHALL complete in under 3 seconds inside a Web Worker without blocking
    the main thread for more than 100 ms.
15. **Purity** — WHILE executing, `diffWorkbooks` SHALL NOT mutate its inputs
    and SHALL NOT perform any network or storage I/O.
