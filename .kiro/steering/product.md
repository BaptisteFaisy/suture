# Suture — Product Steering

_Always included. Source of truth for purpose, audience and vocabulary._

## What Suture is

Suture is **version control for spreadsheets, without the word Git**. It lets
people who exchange `.xlsx` workbooks by email keep versions, open scenarios,
compare two states and combine divergent files — cell by cell — without ever
losing a change and without ever seeing developer jargon.

Built for the **Kiroween 2026** hackathon, category **Frankenstein**: real Git
plumbing (isomorphic-git) stitched to Excel `.xlsx` archives (OOXML), with a
three-way merge at cell level and a safe fallback.

## Core promise (non-negotiable)

1. **Nothing is lost silently.** Every change from both sides of a combine is
   either applied, decided by the user, or listed in the report. (See
   `no-silent-loss.md`.)
2. **The file stays intact.** We never rebuild a workbook; we patch only the
   cells of a carrier file. Charts, formatting, macros survive byte-for-byte.
3. **Everything stays local.** No byte of a workbook leaves the browser. No
   network request after page load (except the opt-in AI summary, off by
   default).
4. **No Git vocabulary in the UI.** The interface speaks office language only.

## Personas

- **Nadia, volunteer treasurer.** Consolidates three people's edits before each
  board meeting. Works in Excel, installs nothing, understands no jargon.
- **Hugo, management controller in an SMB.** Keeps a twenty-sheet forecast and
  wants "hire +2", "delay", "prices +5%" scenarios.
- **Counter-persona: the developer.** She already has Git. Not the target — but
  she must be able to export the tracked workbook and `git clone` it.

## Vocabulary (binding for every UI string)

The UI must only use the right column. A CI guard enforces this
(`scripts/vocabulary-guard.mjs`, wired in the `ci` check and in the Kiro hook
`vocabulary-guard`).

| Git term (BANNED in UI) | Suture term | English UI string |
|---|---|---|
| repository / repo | classeur suivi | Tracked workbook |
| commit | version | Version |
| commit message | note de version | Version note |
| branch | scénario | Scenario |
| main / master branch | référence | Reference |
| diff | comparaison | Compare |
| merge | réunion | Combine |
| conflict | désaccord | Disagreement |
| tag | jalon | Milestone |
| revert | restauration | Restore |
| blame | histoire de la cellule | Cell history |

Banned in user-facing strings: `git`, `commit`, `branch`, `merge`, `conflict`,
`diff`, `repo`, `repository`, `tag`, `revert`, `blame`, `HEAD`, `checkout`,
`stash`, `push`, `pull`, `clone` (exception: the developer-facing **export**
screen may say "Git repository" because that feature exists precisely for
developers — it is the only allowed place).

## Demo mode

Judges must be able to click **"Load the demo workbook"** and get a tracked
workbook with three versions and one divergent scenario, ready to compare and
combine in under two minutes. No account, no upload, no network.

## Success metrics

- Combine on the demo case: **< 2 minutes** (vs ~1 hour by hand).
- Silently lost changes: **zero** (property SUT-P-08).
- 200,000-cell workbook: import < 5 s, compare < 3 s.
