# Suture

**Version control for spreadsheets, without the word Git.**

Suture lets people who exchange Excel workbooks by email keep versions, open
scenarios, compare two states and combine divergent files — cell by cell —
without ever losing a change and without ever seeing developer jargon.

Built for **Kiroween 2026** (category **Frankenstein**): real Git plumbing
(`isomorphic-git`) stitched to Excel `.xlsx` archives (OOXML), with a
three-way combine at cell level and a safe fallback when structures diverge.
Everything runs in the browser — no server, no account, and no byte of your
workbook ever leaves your machine.

## Live demo

**https://baptistefaisy.github.io/suture/** — click **"Load the demo
workbook"**: a tracked workbook with three versions and two divergent scenarios
is ready to compare and combine in under two minutes. No account, no upload,
nothing leaves the browser.

The demo case is the one from the brief: Nadia sends `budget_2026.xlsx` on
Monday; on Thursday she gets back `budget_2026_paul.xlsx` (three amounts
corrected, one row added) and `budget_2026_v2_marie_FINAL.xlsx` (one assumption
changed, and one of the same amounts corrected differently). Suture applies
everything that does not compete, shows the single disagreement with the
original value and both sides, and hands back a workbook that opens in Excel
without a repair prompt.

## Current state

| | |
|---|---|
| Engines | `ooxml-io`, `canonical`, `formula`, `diff`, `merge`, `ooxml-patch`, `git-store` — all implemented and tested |
| Screens | home, workbook (history thread, scenarios, milestones, restore, export), compare (virtualized grid, summary, filters), combine (three-step assistant, disagreements, safe fallback, report), cell history, settings |
| Tests | 362 tests, including the twelve properties SUT-P-01…SUT-P-12 (fast-check) |
| CI | four controls (types, lint, tests, build) in two parallel jobs, each under the five-minute budget, on self-hosted runners |
| Acceptance | `node scripts/check-contest.mjs` — every automated point of the contest checklist is green |
| Kiro usage | `.kiro/steering` (7 files), `.kiro/specs` (8 specs), `.kiro/hooks` (4), `.kiro/agents` (2), `.kiro/skills` (1) — recorded in `KIRO_JOURNAL.md` |

Manual acceptance checklist: `docs/RECETTE.md`. Video script: `docs/VIDEO-SCRIPT.md`.


## What it does

| You want to… | Suture gives you… |
|---|---|
| Bring back two diverged files received by email | The **two-file assistant**: origin + two edited copies, one combine, nothing lost |
| Know who changed a number and when | **Cell history** for any cell, with author, date, note and values |
| Try an assumption without breaking the reference | **Scenarios** — copies that never touch the reference |
| Come back to the state before Tuesday's meeting | **Restore** — a new version identical to the old one, nothing erased |

The workbook file itself is **never rebuilt**: Suture patches only the cells of
a carrier file, so charts, formatting and macros survive byte-for-byte, and the
combined file opens in Excel without a repair prompt.

## Run it locally

Requirements: Node.js 24+ and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:5173/suture/
pnpm test:run     # unit + property tests (fast-check)
pnpm build        # static build in apps/web/dist
```

## Architecture

```
 .xlsx file
    │
    ▼
 ooxml-io ──▶ canonical ──▶ diff ──▶ ChangeSet ──▶ UI (grid, summary)
 (zip, XML)   (cells/*.tsv)  │                        ▲
    │                        ▼                        │
    │                     merge ──▶ MergePlan ─────────┘
    │                        │
    ▼                        ▼
 git-store ◀────────── ooxml-patch ──▶ combined file
 (isomorphic-git, browser storage)
```

Each version is a real Git commit whose tree holds two views of the workbook:
`ooxml/` (the parts, byte-for-byte) and `cells/` (one line per cell — what
compares and combines read, and what `git log -p` shows a developer).
Exporting a tracked workbook yields an archive containing a clonable Git
repository.

| Package | Role |
|---|---|
| `packages/contracts` | Shared types and invariants |
| `packages/ooxml-io` | Zip/unzip OOXML parts, limits, refusal codes |
| `packages/canonical` | Deterministic derivation of the cell view |
| `packages/formula` | A1 ↔ R1C1 conversion and reference shifting |
| `packages/diff` | Row/column alignment, typed change sets |
| `packages/merge` | Three-way combine, disagreements, safe fallback, report |
| `packages/ooxml-patch` | Carrier cell patching, calcChain removal, origin marker |
| `packages/git-store` | Versions, scenarios, milestones, combine commits, export |
| `packages/ui` + `apps/web` | React screens, i18n (English default, French), demo |

## Dependencies and licenses

| Dependency | License | Used for |
|---|---|---|
| fflate | MIT | ZIP (OOXML parts) |
| saxes | ISC | Streaming XML parsing |
| isomorphic-git | MIT | Git objects, branches, merge commits |
| @isomorphic-git/lightning-fs | MIT | Browser storage for the repository |
| zod | MIT | Input validation |
| react / react-dom | MIT | User interface |
| vite, vitest, fast-check, eslint, typescript | MIT / Apache-2.0 | Build, tests, lint |
| exceljs | MIT | **Test oracle only** (never shipped) |

Strong copyleft is deliberately excluded: no HyperFormula (GPLv3), no
TruffleHog (AGPL).

## Prior code

No code predates the contest submission window: the repository was created on
2026-11-11 for Kiroween 2026 and everything was written during the submission
period, with Kiro. See `KIRO_JOURNAL.md` for the running record of Kiro usage
(specs, steering, hooks, properties, comparison against "vibe coding").

## License

MIT — see `LICENSE`.
