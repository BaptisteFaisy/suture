# Design: Git Store (Quick Spec)

## Context

`packages/git-store` wraps isomorphic-git behind a small, intent-named API
(versions, scenarios, milestones, restore, cell history, export). It depends on
`@suture/contracts`, `@suture/canonical` and `@suture/ooxml-io` only.

## Storage backends

| Environment | Filesystem | Notes |
|---|---|---|
| Browser | `@isomorphic-git/lightning-fs` over IndexedDB | One FS namespace per tracked workbook (`suture-<id>`); `navigator.storage.persist()` requested on first save |
| Tests / SSR | in-memory fs (`memfs`-style adapter inside the package) | Deterministic, no disk I/O, no network |

The FS is injected: `createStore({ fs, dir })`. `dir` is a stable slug derived
from the workbook id, so a reload finds the same repository.

## Repository layout (inside the Git repo)

```
ooxml/                  # unzipped OOXML parts, byte-identical to the saved file
cells/
  _workbook.json
  01-budget.tsv
.suture/format.json     # {"version":1}
```

Branch `reference` is the Reference branch; each scenario is a branch named
`scenario/<slug>`. Milestones are annotated tags. Author identity
(`name`, `email`) comes from Settings.

## TypeScript structures (`@suture/contracts`)

```ts
export interface TrackedWorkbook {
  readonly id: string;              // slug used as FS dir
  readonly title: string;
  readonly createdAt: number;
  readonly referenceBranch: 'reference';
}

export interface VersionRef {
  readonly oid: string;             // Git commit sha
  readonly branch: string;          // 'reference' | 'scenario/<slug>'
  readonly parents: readonly string[];
  readonly author: string;
  readonly message: string;         // version note
  readonly timestamp: number;
}

export interface ScenarioRef { readonly name: string; readonly slug: string; readonly head: string; }
export interface MilestoneRef { readonly name: string; readonly oid: string; }

export interface CellHistoryEntry {
  readonly oid: string;
  readonly author: string;
  readonly timestamp: number;
  readonly message: string;
  readonly before: string | null;
  readonly after: string | null;
}

export interface SaveVersionInput {
  readonly parts: ReadonlyMap<string, Uint8Array>;   // ooxml/ contents
  readonly branch: string;
  readonly message: string;
  readonly author: { name: string; email: string };
  readonly parents?: readonly string[];              // two for a combine
}
```

## Public API (`packages/git-store/src/index.ts`, functions < 50 lines)

```ts
createStore(opts): Promise<GitStore>;

interface GitStore {
  initWorkbook(input: { title: string; parts: PartMap; author: Author; message: string }): Promise<VersionRef>;
  saveVersion(input: SaveVersionInput): Promise<VersionRef | 'unchanged'>;
  readVersion(oid: string): Promise<{ parts: PartMap; cells: CellsView }>;
  listVersions(branch?: string): Promise<VersionRef[]>;
  createScenario(fromOid: string, name: string): Promise<ScenarioRef>;
  tagMilestone(oid: string, name: string): Promise<MilestoneRef>;
  restore(oid: string, author: Author): Promise<VersionRef>;
  combineCommit(input: { ours: string; theirs: string; branch: string; report: string; author: Author }): Promise<VersionRef>;
  cellHistory(sheetFile: string, ref: string, branch: string): Promise<CellHistoryEntry[]>;
  exportBundle(): Promise<Uint8Array>;
}
```

## Algorithms

1. **saveVersion** — derive `cells/` via `@suture/canonical` (freshness
   asserted), compare tree oid with the branch head tree; equal → return
   `'unchanged'` (SUT-F-03). Else write blobs, build tree, `git.commit`
   with `parent` (one, or the two given for a combine) and
   `ref: 'refs/heads/<branch>'`.
2. **restore** — `readVersion(oid)` then `saveVersion` on the current branch
   with a message "Restored <milestone or version label>". No branch
   reset, no history rewrite: the old commit simply gains a descendant.
3. **combineCommit** — commit with `parent: [ours, theirs]`; the report text
   is appended to the version note under a `---` separator.
4. **cellHistory** — `git.log({ ref: branch })` newest-first, read each
   commit's `cells/<sheet>.tsv` (blob read via tree walk, cached by oid),
   diff consecutive states for the single `ref` line, emit an entry when
   `input` differs. Stop at the root commit.
5. **exportBundle** — walk all refs and objects, write a bare-repository
   tarball layout (`objects/`, `refs/`, `HEAD`, `config`) into a ZIP via
   `fflate`. `git clone <dir>` works with no Suture tooling (SUT-F-29).
6. **quota / staleness** — after each save, compare
   `navigator.storage.estimate()` usage to quota (> 80 % → warn) and store
   `lastExportAt`; > 30 days → warn (SUT-N-05).

## Error handling

| Case | Behavior |
|---|---|
| FS quota exceeded | typed `GitStoreError('quota-exceeded')`; the save is aborted, nothing partial is committed |
| Branch already exists (scenario name clash) | `GitStoreError('scenario-exists')`, caller proposes a suffix |
| `readVersion` on unknown oid | `GitStoreError('unknown-version')` |
| Derived `cells/` stale before commit | `GitStoreError('canonical-stale')` — blocks the save (never commit an inconsistent tree) |
| Restore target unreachable from active branch | still allowed: restore reads the oid directly, then commits on the active branch |
| Corruption detected on load (`git.log` fails) | surface a readable message, offer the last export; never auto-delete the repo |

## Testing strategy

- **Unit**: in-memory FS; init/save/unchanged, scenario isolation,
  milestone tag, restore appends without removing, combine two parents,
  cell history over three versions, export archive contains `HEAD`+`refs`.
- **Property SUT-P-12** (fast-check, seeds in `KIRO_JOURNAL.md`): random
  sequence of save/scenario/restore operations; assert (a) every recorded
  oid still restores byte-identical `ooxml/` parts, (b) commit count is
  monotonically non-decreasing, (c) no ref disappears.
- **Integration**: export bundle → `git clone` + `git log -p -- cells/`
  in a test container, assert readable TSV diffs (skipped when git absent).
- No network, no real IndexedDB in tests (fake-indexeddb only if needed).
