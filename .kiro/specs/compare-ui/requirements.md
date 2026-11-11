# Specification: Compare UI (Design-First)

## Requirements

### Overview
`compare-ui` delivers screen 3 (**Compare**) and screen 5 (**Cell history
drawer**) of Suture. It renders a `ChangeSet` produced by `@suture/diff`:
a virtualized grid on the left, a deterministic summary and filters on the
right. Everything is client-side, accessible and jargon-free.

### Design-first note
This spec is written design-first: the interaction model below drives the
requirements, not the reverse. The acceptance criteria still use EARS and the
`SUT-*` identifiers from the product brief.

### User Stories & Acceptance Criteria (EARS)

#### Screen 3 — Compare

**SUT-F-12: Comparison grid**
- **WHEN** the user selects two versions (P3),
  **THEN** the system SHALL display a grid showing the changed cells with a
  symbol `+` (added), `−` (removed) or `~` (modified) in a dedicated column,
  in addition to colour.
- **WHEN** a row was inserted or deleted,
  **THEN** the system SHALL render it as a band spanning the grid width, and
  SHALL NOT mark as modified the cells merely shifted down (SUT-F-09).
- **WHEN** a cell's `cached` value changed while its `input` did not,
  **THEN** the system SHALL render it as a "recalculated result" in a
  visually recessed style and SHALL exclude it from the "typed changes"
  filter by default (SUT-F-08).
- **WHEN** only a cell's number format changed,
  **THEN** the system SHALL hide that difference by default and expose it
  behind a disabled-by-default filter.
- **WHEN** the user activates the sheet filter or the nature filter
  (typed change / recalculated result / structure / format),
  **THEN** the system SHALL update the grid and the summary counts
  consistently and SHALL announce the new counts politely.
- **WHEN** the user presses the "next difference" shortcut,
  **THEN** the system SHALL move focus to the next difference in reading
  order and SHALL wrap at the end.

**SUT-F-13: Deterministic summary**
- **WHEN** a `ChangeSet` is loaded,
  **THEN** the system SHALL render a deterministic summary, e.g.
  "3 typed changes, 1 row added, 14 recalculated results, including
  Total (B14): 120 000 → 131 500", built only from the `ChangeSet`.
- **WHEN** the summary is rendered,
  **THEN** it SHALL be exposed as a single readable block to assistive
  technology (one accessible name, no per-number noise), and SHALL be
  copyable as plain text.
- **WHERE** the optional AI rewrite (SUT-F-14) is enabled,
  **THEN** the deterministic summary SHALL remain displayed alongside it.

**SUT-F-15: Non-cell parts**
- **WHEN** charts, pivot tables, macros or styles changed,
  **THEN** the system SHALL list them in a "Not compared in detail"
  section with their state (changed / identical), without implying any cell
  change.

**SUT-N-07: Accessibility**
- **WHILE** the grid is displayed,
  **THEN** the system SHALL support full keyboard navigation (arrows,
  Home/End, Ctrl+Home/End, Page Up/Down) and a focus ring meeting WCAG 2.1
  AA contrast.
- **WHILE** the user has `prefers-reduced-motion: reduce`,
  **THEN** the system SHALL disable non-essential transitions and smooth
  scroll animations.
- **WHEN** a difference receives focus,
  **THEN** the system SHALL announce its sheet, address, nature, previous and
  new value through a live region.

**SUT-N-03: Responsiveness**
- **WHILE** a 200,000-cell workbook is compared,
  **THEN** the grid SHALL virtualize rows and columns so that scrolling
  never blocks the main thread for more than 100 ms.

#### Screen 5 — Cell history drawer

**SUT-F-26: Cell history**
- **WHEN** the user selects a cell and opens its history,
  **THEN** the system SHALL show a side drawer listing each version where
  the cell's typed input changed, newest first, with author, date, version
  note and before/after values.
- **WHEN** the drawer is open,
  **THEN** focus SHALL move into the drawer, `Escape` SHALL close it, and
  focus SHALL return to the originating grid cell.
- **IF** the cell never changed after its creation,
  **THEN** the system SHALL say so explicitly instead of showing an empty
  list.

#### Cross-cutting

**SUT-N-08: Languages**
- **WHERE** the interface language is French,
  **THEN** the system SHALL display all strings, numbers, dates and decimal
  separators in French; **WHERE** it is English (default), **THEN** in
  English. Switching SHALL NOT reload the page.

**SUT-N-09: Vocabulary**
- **WHILE** any Compare UI string is rendered,
  **THEN** it SHALL use only the approved vocabulary (Compare, Version,
  Scenario, Reference, Milestone, Cell history, …) and SHALL NEVER contain
  a banned Git term; the `vocabulary-guard` hook and CI check SHALL fail on
  violation.
