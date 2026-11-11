# Design: Compare UI (Design-First)

## Context

Screen 3 (Compare) and screen 5 (Cell history drawer). Consumes `ChangeSet`
from `@suture/diff`, `CellHistoryEntry` from `@suture/git-store`. Lives in
`packages/ui` (components) + `apps/web` (routing/screens). No data leaves the
browser; no network after load.

## Screen layout — Compare (screen 3)

```
┌───────────────────────────────────────────────────────────────┬──────────────┐
│ toolbar: [sheet ▾] [nature: typed | recalculated | structure] │ Summary      │
│          [next difference ⏎] [expand format changes]          │ ─────────    │
├───────────────────────────────────────────────────────────────┤ 3 typed      │
│  A     B              C                D                      │ 1 row added  │
│ ~ B7   12 000 → 13 500        #,##0 €                         │ 14 results   │
│ ▸ (row inserted)                                              │ …            │
│   B14  …                                                      │ Filters      │
│                                                               │ Not compared │
└───────────────────────────────────────────────────────────────┴──────────────┘
```

Left: virtualized grid (fixed row height, column virtualization beyond a
threshold). Right rail: summary, filters, "not compared in detail" list.

## Design-first interaction model

1. **Reading order = change order.** The grid is filtered to the union of
   changed rows plus 2 context rows above/below each, so a diff reads like a
   review, not a spreadsheet dump.
2. **Symbol before colour.** Every changed cell carries a glyph in a leading
   gutter column; colour is redundant reinforcement only (WCAG 1.4.1).
3. **One verb per surface.** "Next difference" is the only navigation verb;
   filters narrow, they never reorder.
4. **The summary is the contract.** Screen-reader users get the whole story
   from the summary block alone; the grid is the drill-down.

## TypeScript structures (`@suture/contracts`)

```ts
export type ChangeNature = 'typed' | 'recalculated' | 'structure' | 'format';
export type ChangeSymbol = '+' | '-' | '~';

export interface CellChangeView {
  readonly sheetId: string;
  readonly ref: string;            // "B14"
  readonly nature: ChangeNature;
  readonly symbol: ChangeSymbol;
  readonly before: string | null;
  readonly after: string | null;
  readonly fmtBefore?: string;
  readonly fmtAfter?: string;
}

export interface StructureChangeView {
  readonly sheetId: string;
  readonly kind: 'row-inserted' | 'row-removed' | 'col-inserted' | 'col-removed' | 'sheet-added' | 'sheet-removed' | 'sheet-renamed';
  readonly index: number;
  readonly label: string;          // "Row 12", "Sheet Budget → Forecast"
}

export interface CompareView {
  readonly cells: readonly CellChangeView[];
  readonly structure: readonly StructureChangeView[];
  readonly otherParts: readonly { readonly name: string; readonly changed: boolean }[];
  readonly counts: { typed: number; recalculated: number; structure: number; format: number };
}

export interface HistoryEntryView {
  readonly oid: string;
  readonly author: string;
  readonly timestamp: number;      // epoch ms, formatted per locale
  readonly note: string;
  readonly before: string | null;
  readonly after: string | null;
}
```

## Components (`packages/ui`, each file < 500 lines, functions < 50)

```
src/compare/
  CompareScreen.tsx        screen shell, state (filters, active diff)
  ChangeGrid.tsx           virtualized grid (rows + columns)
  GridRow.tsx              one row, including structure bands
  ChangeCell.tsx           symbol gutter + before/after rendering
  SummaryPanel.tsx         deterministic summary + copy button
  FilterBar.tsx            sheet + nature filters
  OtherPartsList.tsx       charts/pivots/macros/styles list
  useVirtualWindow.ts      windowing math (shared with merge-wizard)
  useDifferenceNavigation.ts  keyboard traversal, wrap-around
src/history/
  CellHistoryDrawer.tsx    side drawer, focus trap, Escape to close
  HistoryEntry.tsx         one entry
src/i18n/
  messages.en.ts, messages.fr.ts, format.ts (numbers, dates)
```

## Algorithms

1. **Virtual window** — given row height `h`, viewport `H`, scrollTop `s`:
   render rows `floor(s/h) - overscan .. ceil((s+H)/h) + overscan`.
   Column window computed identically against a cumulative width array.
2. **Filter pipeline** — `CompareView` → `applyFilters(view, {sheet, natures})`
   → visible rows. Counts in the summary always reflect the *filtered* set,
   recomputed with the same function used by the summary text builder, so the
   two can never disagree.
3. **Summary builder** — pure function `buildSummary(counts, topChanges, locale)`
   returning a single string + a structured array for the accessible name.
   Deterministic: same `ChangeSet` → same string (no timestamps, no ordering
   by hash).
4. **Difference navigation** — an ordered index array of visible change
   indices; `next()` / `prev()` with wrap; each move calls `scrollToRow` and
   updates the live region (`aria-live="polite"`, debounced 150 ms).
5. **History drawer** — `cellHistory(sheet, ref, branch)` from `git-store`,
   mapped to `HistoryEntryView`, rendered newest first; empty state is an
   explicit sentence.

## Accessibility contract

| Concern | Implementation |
|---|---|
| Contrast | All text ≥ 4.5:1, symbols ≥ 3:1, verified by a palette unit test |
| Symbols | `+`, `−` (U+2212), `~` in a gutter cell with an `aria-label` ("added", "removed", "modified") |
| Keyboard | Roving tabindex in the grid; arrows/Home/End/PageUp/Down; `Enter` opens cell history; `Escape` closes drawer |
| Live region | Single polite region announcing "Sheet Budget, B7, modified, 12 000 → 13 500" |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` disables transitions and smooth scroll |
| Summary | `role="status"` block, full sentence, plus a "Copy summary" button |
| Focus | Drawer traps focus; on close, focus returns to the originating cell |

## Error and empty states

| Case | UI |
|---|---|
| No change between versions | "These two versions are identical." (no empty grid) |
| `ChangeSet` fails to build | "Comparison unavailable" + retry; the versions stay selectable |
| Cell has no history | "No change recorded for B7." |
| History read fails | Drawer shows the error and a retry, never a silent empty list |
| Workbook above the cell limit | Import refused upstream (SUT-F-04); Compare never renders it |

## Testing strategy

- **Unit**: summary builder determinism (golden strings, en + fr), filter
  pipeline counts, virtual window math, symbol/aria-label mapping, number and
  date formatting per locale.
- **Component (Testing Library)**: keyboard traversal with wrap-around,
  live-region announcements, drawer focus trap and restore, reduced-motion
  class application, contrast assertions on the palette.
- **Vocabulary**: every rendered string passes `scripts/vocabulary-guard.mjs`;
  a unit test renders both locales and greps for banned terms.
- **Performance**: a synthetic 200,000-cell `ChangeSet` renders and scrolls
  within the 100 ms budget (measured in Playwright, outside PR CI).
- **Property (light)**: `applyFilters` is idempotent and never invents cells
  absent from the `ChangeSet`.
