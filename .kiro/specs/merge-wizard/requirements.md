# Specification: Merge Wizard (Design-First)

## Requirements

### Overview
`merge-wizard` delivers screen 4 (**Combine**: a three-step assistant), the
"two files received by email" entry point (path P6), and screen 2 (**Workbook**:
the history thread with scenarios and milestones). It drives `@suture/merge`
and `@suture/ooxml-patch` through a calm, sewing-workshop interface where no
change can be lost silently.

### Design-first note
The three-step rhythm (what applies alone → what must be decided → the report)
is the primary design decision; requirements below describe it in EARS form.

### User Stories & Acceptance Criteria (EARS)

#### SUT-F-17 / P6 — Two files received by email
- **WHEN** the user provides an original workbook and two modified copies,
  **THEN** the system SHALL create the missing versions and scenarios (one
  per copy), start the combine from the original, and open step 1 of the
  assistant, without asking the user to name anything technical.
- **IF** one of the three files is unreadable, encrypted or above the limits,
  **THEN** the system SHALL explain which file and why, and SHALL NOT create
  any version.

#### Step 1 — What applies on its own (SUT-F-18)
- **WHEN** the combine plan is computed,
  **THEN** the system SHALL first show every change made by only one side, as
  a grouped list per sheet ("Applied from Paul", "Applied from Marie"), with
  counts and a jump-to-cell link.
- **WHILE** step 1 is displayed,
  **THEN** the user SHALL be able to inspect any applied change in the grid
  before moving on, and SHALL NOT be able to edit it.

#### Step 2 — Disagreements to settle (SUT-F-19)
- **WHEN** a cell was changed differently on both sides,
  **THEN** the system SHALL show, for that cell: the original value, the two
  competing values with their side labels, and a free-entry field.
- **WHEN** the user picks a side or types a value,
  **THEN** the system SHALL record the decision with the chosen source and
  SHALL mark the cell as settled.
- **WHILE** at least one disagreement remains open,
  **THEN** the "Continue" action SHALL be disabled and the count of open
  disagreements SHALL be visible and announced.
- **WHERE** a disagreement concerns a formula,
  **THEN** the system SHALL display the formula as text and the resolved
  value after recalculation on open, never a stale cached number.

#### SUT-F-20 — Safe fallback per sheet
- **IF** both sides changed the structure of the same sheet differently,
  **THEN** the system SHALL refuse automatic combination for that sheet,
  SHALL ask which side's layout to keep, and SHALL list the other side's
  changes as items to reapply by hand.
- **WHEN** the user chooses the kept side,
  **THEN** the report SHALL record the choice and every listed change from the
  other side, and the combined file SHALL use the chosen side's layout.

#### SUT-F-21 — Combine report
- **WHEN** the combine is complete,
  **THEN** the system SHALL produce a report with four sections — applied,
  settled, not carried over, to check — and SHALL offer it for download and
  attach it to the version note.
- **WHEN** the user copies or downloads the report,
  **THEN** every entry SHALL identify sheet, cell or part, both sides and the
  outcome, in the active interface language.

#### SUT-F-22 — Combined file
- **WHEN** the user downloads the combined workbook,
  **THEN** the system SHALL produce it by patching the carrier at cell level
  only, SHALL request full recalculation on open, and SHALL keep charts,
  formatting and macros from the carrier intact (SUT-P-10).

#### SUT-F-23 / SUT-F-27 — Saving and restoring the combine
- **WHEN** the user saves the combined workbook,
  **THEN** the system SHALL create a version with two origins (SUT-F-23) and
  SHALL NOT remove any existing version (SUT-F-27).

#### Screen 2 — History thread (SUT-F-25, SUT-F-16, SUT-F-28)
- **WHEN** the user opens a tracked workbook,
  **THEN** the system SHALL display its versions, scenarios and combines as a
  single continuous thread, each version a point, each combine a visible
  suture joining two edges, milestones marked on the thread.
- **WHEN** the user creates a scenario or names a milestone,
  **THEN** the system SHALL show it immediately on the thread without a page
  reload.

#### SUT-N-07 / SUT-N-08 / SUT-N-09 — Accessibility, language, vocabulary
- **WHILE** any wizard step is displayed,
  **THEN** it SHALL be fully keyboard operable, every disagreement SHALL be
  reachable and settable without a mouse, and status changes SHALL be
  announced through a polite live region.
- **WHERE** the interface language is French,
  **THEN** all strings, numbers and dates SHALL be French; English is the
  default. No banned Git term SHALL ever appear (CI + `vocabulary-guard`).
