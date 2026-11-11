# Video script — Suture (Kiroween 2026)

Target: under 3 minutes, public on YouTube, no licensed music, no third-party
brand on screen, English (or English subtitles). The application must really run
on screen.

## 0:00 — 0:20 · The situation

Screen: a folder full of `budget_v7_final_FINAL(2).xlsx`, `budget_v7_final_FINAL.xlsx`,
`budget_2026_paul.xlsx`, `budget_2026_v2_marie_FINAL.xlsx`.

Voice-over: *"Nadia sends the budget on Monday. On Thursday she gets two
different files back. Comparing them by hand takes an hour, and nobody can
promise that no change was lost. She is not a developer — she has never heard
the word Git. Suture is version control for spreadsheets, without the word
Git."*

## 0:20 — 0:50 · The first version

Screen: Suture home, drop `budget_2026.xlsx`.

Voice-over: *"She drops the file. The first version is created. She edits the
file in Excel and drops it again: Suture shows what changed — 3 edited
entries, 1 added row, 14 recalculated results — and separates what a person
typed from what the spreadsheet recalculated. She confirms, and the version is
recorded."*

## 0:50 — 1:40 · The heart: combining two diverged files

Screen: the two-file assistant — original, Paul's file, Marie's file — then the
combine wizard.

Voice-over: *"Paul changed three amounts and added a row. Marie changed an
assumption, and changed one of the same amounts differently. Suture compares
both sides against the original and applies everything that does not compete.
One cell disagrees: 60 000 in the reference, 61 000 from Paul, 62 000 from
Marie. Suture shows the original value and both sides. Nadia decides. The
combined workbook downloads — and it opens in Excel with its chart and its
formatting: Suture never rebuilds a file, it only touches the cells."*

## 1:40 — 2:00 · Cell history and restore

Screen: click cell B5 in the history graph, then restore.

Voice-over: *"Who changed this number, and when? Click the cell: four changes,
with the date, the author, the note, the values before and after. And to go
back to Tuesday's version? Restore: a new version, identical to the old one.
Nothing is ever erased."*

## 2:00 — 2:20 · It was Git all along

Screen: the export panel, a terminal with `git clone` and `git log -p -- cells/`.

Voice-over: *"A developer can leave at any time: the tracked workbook exports
as an archive containing a real Git repository. Clone it, and the history of
every cell is readable. It was Git all along — just never spoken."*

## 2:20 — 2:50 · How Kiro helped

Screen: the repository — `.kiro/steering`, `.kiro/specs`, `.kiro/hooks`, and a
property test failing on a counterexample, then the vocabulary guard refusing a
word.

Voice-over: *"Suture was built with Kiro. One spec per lot — from OOXML
reading to the three-way combine. Steering files hold the rules: no Git word
in the interface, and never lose a change silently. Hooks run the property
tests on every save: one of them found a counterexample the hand-written
tests missed. And the vocabulary guard refused the word 'commit' in a button
label."*

## 2:50 — 3:00 · Closing

Screen: the history graph — a thread, versions as points, a visible stitch
where the two sides meet — then the address on screen.

Voice-over: *"Every version is a stitch. The address is on screen. Try it on
your own workbook — nothing leaves your browser."*

## Shooting notes

- Record at 1920×1080, 60 fps, browser zoom 100 %, in a private window.
- No music. No third-party logos or brand names in the frame (no Excel
  splash on screen; use the file manager instead of opening Excel during the
  shot, or crop the interface).
- The demo must run on the deployed address: https://baptistefaisy.github.io/suture/
- Captions in English (the contest asks for English or English subtitles).
- Keep the pace: the three "money" moments are the 0:50 minute (combining),
  the 2:20 minute (Git underneath) and the 2:50 minute (the stitch).
