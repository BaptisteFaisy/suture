# Suture — Tech Steering

_Always included. Stack, versions, hard bans._

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript ≥ 5.6, `strict: true` | No `any` without an eslint-disable comment + reason |
| Runtime | Node.js 24 LTS (CI), evergreen browsers (app) | The app itself is 100% client-side |
| Package manager | pnpm (workspace protocol) | One lockfile at the root |
| Bundler / app | Vite + React 19 | Static hosting (GitHub Pages), base `/suture/` |
| Validation | Zod | Every user-provided input (files, settings) is parsed at the boundary |
| Unit / property tests | Vitest + fast-check | Properties SUT-P-01..12, seeds logged in `KIRO_JOURNAL.md` |
| E2E | Playwright | **Outside PR CI** (dedicated workflow on main only) |
| Zip | `fflate` (MIT) | Decompress / recompress OOXML parts |
| XML | `saxes` (ISC) or a home-grown sheet XML reader/writer | Streaming, **no external entities** |
| Git | `isomorphic-git` (MIT) + `@isomorphic-git/lightning-fs` (MIT) | Runs in the browser over IndexedDB |
| Test oracle only | `exceljs` (MIT) | **devDependency of test packages only**, never shipped |

## Hard bans

1. **No copyleft dependency** in shipped code: GPLv3 (HyperFormula) and AGPL
   (TruffleHog) are out. Every added dependency: license checked and listed in
   the README table.
2. **No network call** from app code after page load. The only exception is the
   opt-in AI summary (SUT-F-14), disabled by default, behind a provider
   interface, and it may only send change metadata — never workbook bytes,
   never personal data.
3. **No Git vocabulary in UI strings** (see `product.md`); enforced by
   `scripts/vocabulary-guard.mjs`.
4. **Never rebuild a workbook.** Only patch the cells of a carrier file
   (`ooxml-patch`); everything else is copied byte-for-byte (property
   SUT-P-10).
5. **Macros are never executed nor interpreted.** `.xlsm` parts are carried
   as-is.
6. **No `eval`, no `new Function`, no `dangerouslySetInnerHTML`.**
7. XML parsing must not resolve external entities (XXE).
8. Zip bombs: decompressed size limit **50 MB**, cell count limit
   **1,000,000**, compression-ratio guard, entry-count guard.

## Code shape (workspace rule "CI-BUDGET / code limits")

- Every source file **< 500 lines**; every function **< 50 lines**. Split
  instead of growing. `scripts/check-line-limits.mjs` enforces it in CI.
- Zero duplication: shared helpers live in `packages/contracts` (types) or the
  owning package and are imported, never copied.

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

- `packages/contracts` — shared TypeScript types, frozen interfaces. **A
  package must not change contracts outside its own spec.**
- `packages/ooxml-io` — unzip/zip, part listing, limits.
- `packages/canonical` — derive `cells/*.tsv` + `_workbook.json` from parts.
- `packages/formula` — A1 ↔ R1C1 conversion, reference shifting.
- `packages/diff` — row/column alignment, `ChangeSet`.
- `packages/merge` — three-way plan, disagreements, report.
- `packages/ooxml-patch` — carrier patching, calcChain removal,
  `fullCalcOnLoad`, origin marker (docProps/custom.xml).
- `packages/git-store` — versions, scenarios, milestones, merge commits,
  export bundle, cell history.
- `packages/ui` + `apps/web` — React screens, i18n (en default, fr), demo set.

## CI contract

- Check `ci` ≤ **5 minutes** (timeout-minutes: 5, `fetch-depth: 1`, per-PR
  concurrency). Never raise a timeout; move heavy work out of PR CI.
- Required checks on `main`: `ci`, `ci-budget`, `couche0`.
- Self-hosted runners: label `suture-worker` (r630, Node 24 in `~/node24/bin`,
  pnpm on PATH). pnpm store shared under `~/.local/share/pnpm` / `~/pnpm/store`.
