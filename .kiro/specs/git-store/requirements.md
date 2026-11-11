# Specification: Git Store (Quick Spec)

## Requirements

### Overview
`git-store` is the persistence layer: a real Git repository per tracked
workbook, held entirely in the browser (isomorphic-git +
@isomorphic-git/lightning-fs over IndexedDB; in-memory fs for tests). Every
version is a commit whose tree holds `ooxml/`, `cells/` and
`.suture/format.json` (see `canonical-format.md`). The UI never says "Git":
versions, scenarios, milestones, restores.

### User Stories & Acceptance Criteria (EARS)

#### SUT-F-02: Saving a version
- **WHEN** the user confirms a new version of a tracked workbook,
  **THEN** the system SHALL create a Git commit whose tree contains the
  unzipped parts under `ooxml/`, the derived view under `cells/`
  (`_workbook.json` + one `.tsv` per sheet) and `.suture/format.json`, with
  the version note as commit message and the configured author name.
- **WHEN** the commit is created,
  **THEN** the system SHALL verify the derived `cells/` view is fresh
  (re-derive and compare) before writing, and SHALL fail the save otherwise.

#### SUT-F-03: Identical file
- **IF** the file being saved has the same canonical content as the current
  version,
  **THEN** the system SHALL report "no change" and SHALL NOT create a commit.

#### SUT-F-16: Scenarios (branches)
- **WHEN** the user creates a scenario from a version,
  **THEN** the system SHALL create a Git branch at that commit.
- **WHEN** a version is saved while a scenario is active,
  **THEN** the system SHALL commit on that scenario's branch and SHALL NOT
  move the Reference branch.

#### SUT-F-28: Milestones (tags)
- **WHEN** the user names a version as a milestone,
  **THEN** the system SHALL create an annotated Git tag at that commit and
  SHALL display it on the history graph.

#### SUT-F-23: Combine versions (merge commits)
- **WHEN** a combine completes and the user saves it,
  **THEN** the system SHALL create a merge commit with exactly two parents
  (the two combined versions) on the target branch, with the combine report
  attached to the version note.

#### SUT-F-27: Restore
- **WHEN** the user restores an older version,
  **THEN** the system SHALL create a NEW commit with the same content and
  SHALL NOT remove, rewrite or hide any existing commit, branch or tag.

#### SUT-F-26: Cell history
- **WHEN** the user asks for the history of a cell,
  **THEN** the system SHALL walk commits reachable from the active scenario
  and SHALL list every version where that cell's `input` changed in its
  sheet `.tsv`, with author, timestamp, version note, and before/after values.

#### SUT-F-29: Export
- **WHEN** the user exports a tracked workbook,
  **THEN** the system SHALL produce a downloadable archive containing a
  standard, clonable Git repository (objects, refs, HEAD) that `git clone`
  and `git log -p -- cells/` read without any Suture-specific tooling.

#### SUT-N-01 / SUT-N-05: Local-only storage
- **WHILE** a tracked workbook exists,
  **THEN** the system SHALL keep all Git objects in the browser's private
  storage (IndexedDB), SHALL request storage persistence, and SHALL warn the
  user when the quota is near or no export happened for 30 days.

#### SUT-P-12: Restorability property
- **WHERE** any sequence of versions, scenarios, combines and restores has
  been performed,
  **THEN** every committed version SHALL still restore to byte-identical
  `ooxml/` parts, and a restore SHALL append a commit without removing any.
