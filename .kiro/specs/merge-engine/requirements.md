# Requirements: merge-engine

## Introduction

`@suture/merge` (`packages/merge`) implements the three-way combine that is the
heart of Suture's Frankenstein chimera: real three-way merging applied cell by
cell to Excel workbooks, for people who have never heard the word "merge".
Given a common origin `O` and two divergent versions `A` ("mine") and `B`
("theirs"), it computes `ΔA = diff(O, A)` and `ΔB = diff(O, B)`, classifies each
sheet into one of four structural cases, produces a `MergePlan` (automatic
applications, disagreements for the user to decide, and a report of everything
not carried over), and drives the carrier-patching step that yields the combined
file.

Its binding guarantee is **no silent loss** (`no-silent-loss.md`, `SUT-P-08`):
every change in `ΔA ∪ ΔB` ends up applied, decided by the user, or listed in the
report — never absent.

## Personas & User Stories

- **Nadia (volunteer treasurer)**: Runs the "two received files" wizard
  (original + Paul's + Marie's); unopposed edits apply silently, the single
  disagreement is presented with origin and both competing values, she picks one,
  and the combined file downloads in under two minutes (`SUT-F-17`, `SUT-F-18`,
  `SUT-F-19`, O1).
- **Hugo (management controller)**: Combines his "hire +2" scenario into the
  reference; his inserted rows become the carrier and Marie's edits are mapped
  through the alignment table (`SUT-F-16`, structural Case 2).
- **Cautious user**: When both sides restructured the same sheet differently,
  Suture refuses to guess, asks which side to keep, and lists the other side's
  changes in the report for manual application (`SUT-F-20`).
- **Developer (counter-persona)**: Inspects the combine result: a two-parent
  merge version in history (`SUT-F-23`) and a downloadable report attached to
  the version note (`SUT-F-21`).

## Acceptance Criteria (EARS)

### Three-Way Combine Core

1. **SUT-F-18 (Automatic application)** — WHEN a cell input was modified by
   exactly one side, the system SHALL apply that side's value automatically
   without user intervention.
2. **Convergent edits** — WHEN both sides typed the same value into the same
   cell, the system SHALL apply it automatically (not a disagreement).
3. **SUT-F-19 (Disagreements)** — WHEN both sides typed different values into
   the same cell, the system SHALL record a `Disagreement` showing the origin
   value and both competing values, offering resolution `A`, `B`, or a
   user-typed value; WHILE any disagreement remains unresolved, the combine
   SHALL NOT be saveable.
4. **SUT-P-06 (Identity laws)** — WHEN combining, the system SHALL satisfy
   `combine(O, A, O) == A`, `combine(O, O, B) == B`, and `combine(O, X, X) == X`
   (cell-wise equality).
5. **SUT-P-07 (Disjoint edits never disagree)** — WHEN two sides modify
   disjoint sets of cells without structural changes, the system SHALL produce
   zero disagreements and apply every change.
6. **SUT-P-09 (Symmetry)** — WHEN `combine(O, A, B)` and `combine(O, B, A)`
   both complete, the resulting cell states SHALL be identical up to swapped
   disagreement sides (side labels exchanged, same values).

### Four Structural Cases (per sheet)

7. **Case 1 (no structural change on either side)** — WHEN neither side inserted
   or deleted rows/columns in a sheet, the system SHALL perform cell-by-cell
   three-way merging with carrier `A`.
8. **Case 2 (one side restructured)** — WHEN exactly one side inserted or
   deleted rows/columns, the system SHALL choose that side as carrier and SHALL
   map the other side's input changes through the alignment table
   (`SheetAlignment.rowMap` / `colMap` from `@suture/diff`).
9. **Case 3 (identical structural edits)** — WHEN both sides performed the same
   structural edits, the system SHALL reduce the sheet to Case 1 on the aligned
   grid.
10. **SUT-F-20 (Case 4, safe fallback)** — IF both sides changed the structure
    of the same sheet differently, THEN the system SHALL refuse automatic
    merging for that sheet, SHALL ask the user which side to keep as carrier,
    and SHALL list every change of the non-chosen side in the report for manual
    re-application.

### Carrier Principle & Formula Transfer

11. **Carrier principle** — WHEN producing the combined file, the system SHALL
    never rebuild a workbook: it SHALL select one side's file as carrier and
    patch only cell contents (`@suture/ooxml-patch`); all non-cell content
    (styles, charts, macros, images) SHALL come from the carrier untouched
    (`SUT-F-22`, `SUT-N-02`).
12. **Carried formulas** — WHEN a formula from the non-carrier side is applied
    to the carrier, the system SHALL convert its stored R1C1 form to A1 at its
    target position in the carrier (relative references shift correctly), SHALL
    remap its absolute references through the alignment maps, and SHALL mark
    ranges spanning an inserted region as "to verify" in the report
    (`SUT-F-21`).
13. **Cached values** — WHEN writing a combined cell, the system SHALL write
    inputs/formulas without computed values and rely on Excel's full recalc on
    open (`SUT-F-22`); stale `cached` values SHALL never be written as if fresh.

### No Silent Loss & Reporting

14. **SUT-P-08 (No silent loss)** — WHEN a combine completes, every element of
    `ΔA ∪ ΔB` (cells, rows, columns, sheets, non-cell parts) SHALL belong to
    exactly one of: applied in the combined workbook, resolved through a
    disagreement decision, or listed in the combine report; NO change SHALL
    disappear.
15. **SUT-F-21 (Report)** — WHEN a combine completes, the system SHALL produce a
    deterministic report with sections `applied`, `decided`, `notCarried`, and
    `toVerify`, downloadable and attachable to the version note; non-cell parts
    changed on the non-carrier side SHALL appear in `notCarried` with a plain
    sentence (e.g. "Chart 2 modified by Marie: not carried over").
16. **Sheet lifecycle in combine** — WHEN one side added, removed, or renamed a
    sheet and the other side did not touch it, the system SHALL carry that sheet
    operation into the plan; IF both sides performed incompatible sheet
    operations on the same sheet, THEN the system SHALL raise it as a
    sheet-level disagreement for user decision.

### Two-File Wizard & Degraded Modes

17. **SUT-F-17 (Two-file wizard support)** — WHEN the wizard supplies an
    original and two modified files, the system SHALL expose a plan API
    (`buildMergePlan(O, A, B)`) usable before any user decision, and an apply
    API (`applyMergePlan(plan, decisions)`) usable after, so the wizard's three
    steps (auto-applied preview, disagreements, report) map 1:1 onto the engine.
18. **SUT-F-24 (No known original, priority S)** — IF no common origin version
    is known, THEN the system SHALL offer a two-way comparison mode where every
    difference is decided by hand, and SHALL NOT fabricate an origin.
19. **Origin marker recognition (priority S)** — WHEN an uploaded working copy
    carries Suture's origin marker (`SUT-F-06`), the system SHALL use the marked
    base version as `O` automatically; IF the marker is missing, THEN the system
    SHALL ask the user to designate the starting version.

### Non-Functional

20. **SUT-N-03 (Performance & workers)** — WHILE building or applying a merge
    plan, the engine SHALL run as pure synchronous functions inside Web Workers;
    the demo combine SHALL complete in under 2 minutes end-to-end (O1).
21. **Determinism** — WHEN the same `(O, A, B)` inputs and the same user
    decisions are supplied, the system SHALL produce identical plans, identical
    combined cell content, and identical reports.
