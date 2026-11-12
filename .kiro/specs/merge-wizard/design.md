# Design: Merge Wizard (Design-First)

## Context

Screens 2 and 4 plus the "two files by email" entry point. Consumes
`MergePlan` from `@suture/merge`, `PatchResult` from `@suture/ooxml-patch`,
`GitStore` from `@suture/git-store`. Everything client-side.

## Art direction — a sewing workshop, not a horror lab

Sober, light, made for finance people. The Frankenstein touch lives in the
metaphor, never in the tone.

| Element | Metaphor | Visual rule |
|---|---|---|
| History (screen 2) | A thread | One continuous 2 px line, versions are round points on it; the line bends, never forks into arrows |
| Combine | A visible suture | Two edges joined by 4–6 short stitches at the meeting point, scar colour (`--suture-scar`, muted rose) |
| Disagreement | A snag (accroc) | A small gap in the thread with a dashed stitch; filled once settled |
| Scenario | A second thread | Parallel thread in `--suture-thread-alt`, converging back at a combine |
| Milestone | A knot | Small filled diamond on the thread with its label |
| Applied change | A tidy seam | Thin solid underline in `--suture-seam` |
| Not carried over | Loose thread | Dashed stub ending in a small circle, always paired with report text |

Palette: paper `#FAF8F5`, ink `#1F1B18`, seam `#2F6F62`, scar `#B4576A`,
alt thread `#4A5D8F`. All pairings ≥ 4.5:1 for text, ≥ 3:1 for graphic marks.
Reduced motion: stitches appear instantly, no draw-in animation.
"Creature" may name the demo workbook in marketing copy, never in the UI.

## Screen 4 — three steps

```
 Step 1 / Applied alone     Step 2 / Disagreements      Step 3 / Report
 ─────────────────────      ──────────────────────      ────────────────
 12 changes from Paul   →   ⚠ B7  Budget              →  Applied   12
  8 changes from Marie       was 11 000 €                Settled    1
 [review in grid]           Paul 12 000 €  ◉            Not carried 2
                            Marie 13 500 € ○            To check    1
                            or type: [________]         [Download report]
                                                       [Download workbook]
```

- One question per screen; the step indicator shows 1–2–3 with names, not
  numbers only.
- "Continue" is disabled while open disagreements remain; the count is
  announced (`aria-live="polite"`).
- Step 3 is the only place with two download buttons; the report is also
  attached to the version note on save.

## TypeScript structures (`@suture/contracts`)

```ts
export type Side = 'ours' | 'theirs';

export interface DisagreementView {
  readonly id: string;
  readonly sheetId: string;
  readonly ref: string;
  readonly origin: string | null;      // original typed input
  readonly ours: string | null;
  readonly theirs: string | null;
  readonly oursLabel: string;          // scenario name or "Paul's file"
  readonly theirsLabel: string;
  readonly isFormula: boolean;
}

export type Decision =
  | { readonly kind: 'ours' }
  | { readonly kind: 'theirs' }
  | { readonly kind: 'custom'; readonly value: string };

export interface FallbackView {
  readonly sheetId: string;
  readonly sheetName: string;
  readonly keptSide: Side | null;      // null until the user chooses
  readonly lostChanges: readonly CellChangeView[];
}

export interface CombineReportView {
  readonly applied: readonly CellChangeView[];
  readonly settled: readonly (CellChangeView & { readonly decision: Decision })[];
  readonly notCarried: readonly string[];   // non-cell parts + fallback items
  readonly toCheck: readonly string[];      // formulas spanning shifted ranges
}

export interface ThreadNodeView {
  readonly oid: string;
  readonly kind: 'version' | 'combine';
  readonly branch: string;             // 'reference' | 'scenario/<slug>'
  readonly parents: readonly string[];
  readonly label: string;              // version note or "Combined with <scenario>"
  readonly author: string;
  readonly timestamp: number;
  readonly milestones: readonly string[];
  readonly openSnags: number;          // unresolved disagreements, 0 for versions
}
```

## Components (`packages/ui`, files < 500 lines, functions < 50)

```
src/combine/
  CombineWizard.tsx        step state machine, guard on open disagreements
  StepApplied.tsx          grouped applied changes per side and sheet
  StepDisagreements.tsx    list + keyboard-settable decisions
  DisagreementCard.tsx     origin / ours / theirs / free entry
  StepReport.tsx           report sections, download report, download workbook
  FallbackPanel.tsx        per-sheet side choice + lost changes list
  useCombinePlan.ts        plan computation in a web worker
src/email/
  TwoFilesWizard.tsx       P6 entry: original + two copies
src/history/
  HistoryThread.tsx        screen 2 SVG thread
  ThreadNode.tsx, ThreadStitch.tsx
  ScenarioBar.tsx          create scenario, pick active one
  MilestoneList.tsx        name a version, list milestones
src/i18n/                  messages.en.ts, messages.fr.ts
```

## Algorithms

1. **Plan computation** — `useCombinePlan` posts the three part maps to a web
   worker (SUT-N-03), which runs `diff(O,A)`, `diff(O,B)` and
   `combine(O,A,B)`, returning `MergePlan`; the main thread only renders.
2. **Step gating** — `canContinue = plan.disagreements.every(d => decision[d.id])`
   and `plan.fallbacks.every(f => f.keptSide !== null)`.
3. **Decision application** — decisions are merged into the plan, which
   produces the final `PatchPlan` for `ooxml-patch`; custom values are
   validated per cell kind (number parse in the active locale, formula must
   start with `=`), errors shown inline.
4. **Report build** — pure function from `MergePlan` + decisions to
   `CombineReportView`, then to Markdown (download) and to the version note
   (`---` separator). Every element of `ΔA ∪ ΔB` lands in exactly one
   section: applied, settled, not carried over (SUT-P-08 made visible).
5. **Thread layout** — versions sorted by timestamp; each branch is a lane;
   a combine node draws two stitched edges from its parents and continues the
   target lane. Vertical spacing is constant, so the thread stays readable
   with hundreds of versions.
6. **Two-files flow** — create version for each uploaded copy (SUT-F-17),
   create a scenario per copy, set the original as origin, then jump into
   step 1.

## Error handling

| Case | Behavior |
|---|---|
| No common origin known (SUT-F-24) | Wizard opens in two-way mode: every difference becomes a manual decision, explicitly labelled |
| Origin marker missing in an incoming file (SUT-F-06 fallback) | Ask the user to designate the starting version before computing the plan |
| Plan computation fails (malformed sheet) | Step 1 shows "Combine unavailable" with the part name and a retry; no version is created |
| Custom value invalid for the cell kind | Inline error, cell stays open, "Continue" disabled |
| Patch fails on download | Error banner naming the sheet; the plan and decisions are kept in memory, nothing saved |
| Quota reached on save | Save blocked with a message offering the export instead of losing work |
| User leaves with open disagreements | Confirmation dialog; decisions are kept in local component state only, never silently persisted as settled |

## Testing strategy

- **Unit**: step gating logic, decision validation per cell kind, report
  builder partition completeness (property: every plan change appears once),
  thread layout lane assignment, locale-aware number parsing for custom values.
- **Component**: full keyboard path through the three steps (settle a
  disagreement without a mouse), live-region announcements, fallback panel
  requires a side before continuing.
- **Property (bridge to `@suture/merge`)**: given a generated `MergePlan`,
  the report view partitions `ΔA ∪ ΔB` with no element lost and none
  duplicated (UI-side check of SUT-P-08).
- **E2E (Playwright, outside PR CI)**: demo workbook → two-files wizard → one
  disagreement settled → workbook downloaded → reopened by the canonical
  reader with the expected cells.
- **Vocabulary**: all rendered strings pass `vocabulary-guard`; a test renders
  both locales and asserts no banned term, including the art-direction labels
  ("suture", "snag", "thread" are allowed; Git words are not).
