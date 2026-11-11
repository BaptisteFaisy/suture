# KIRO_JOURNAL — Suture (Kiroween 2026)

Running record of Kiro usage, kept for the submission form (Kiroween asks
precisely these questions). Everything below happened while building the
project; the numbers are measured, not estimated.

## 1. Overall strategy — how the work was split into specs

Eight specs, one per lot, written before the code of that lot (the specs live
in `.kiro/specs/`, the tasks are ticked as they land).

| Lot | Spec | Path | Why this order |
|---|---|---|---|
| B1 | `ooxml-io` | Requirements-first | Everything downstream reads parts; limits and refusals come first |
| B1 | `formula-r1c1` | Requirements-first | Pure functions; the reference candidate for the spec-vs-vibe comparison |
| B1 | `canonical` (in `ooxml-io`) | Requirements-first | The cell view is the contract between diff and UI |
| B2 | `git-store` | Quick Spec | Bounded surface (versions, scenarios, export) |
| B3 | `diff-engine` | Requirements-first | The change set feeds compare and combine |
| B4 | `ooxml-patch` | Requirements-first | The fidelity guarantee (SUT-P-10) is testable in isolation |
| B5 | `merge-engine` | Design-first | The architecture (carrier + alignment) commands everything |
| B6 | `compare-ui`, `merge-wizard` | Design-first | The screens are shaped by the engines' outputs |

Each spec carries `requirements.md` (EARS acceptance criteria, reusing the
identifiers SUT-F-xx / SUT-N-xx / SUT-P-xx), `design.md` (data structures and
algorithms) and `tasks.md` (numbered checklist).

## 2. Surfaces used

| Surface | What it was used for | What worked | What was missing |
|---|---|---|---|
| Specs (IDE) | Requirements → design → tasks for each of the eight lots | The EARS criteria were directly reusable as fast-check properties | — |
| Steering | Seven files, always included (`product`, `tech`, `structure`, `testing`) plus conditional ones (`no-silent-loss`, `canonical-format`, `ooxml`) | They carried the vocabulary rule, the canonical format and the OOXML traps; the conditional ones are the ones that changed the code | — |
| Hooks | Four command hooks (`vocabulary-guard`, `merge-properties`, `fidelity-check`, `canonical-fresh`) | Command actions consume no credits; each one is mirrored in CI, because a file trigger only sees the agent's own edits | — |
| Properties (fast-check) | The twelve properties SUT-P-01…SUT-P-12 | They found every real bug listed in section 6 | — |
| Custom agents | `.kiro/agents/reviewer.md` (read-only), `.kiro/agents/tester.md` (properties only) | The permissions are explicit in the files | — |
| Skills | `.kiro/skills/suture-fixture/SKILL.md` (building synthetic workbooks) | The fixture builder is deterministic: same descriptor, same bytes | — |
| MCP | Declared in `.kiro/settings/mcp.json` | — | **Not used**: no MCP server was needed; the documentation and the browser were enough |
| CLI headless | — | — | **Not used**: it needs a paid API key, and the CI budget forbids a long review job on every push |
| Web / Crew | — | — | **Not used**: the contest work ran locally on the workstation, with the rules applied by hand |

## 3. Specs against "vibe coding" — measured

The brief names the A1 → R1C1 conversion as the candidate. Two
implementations of the same function were confronted to the same generated
corpus (400 draws); the experiment is replayable with
`pnpm vitest run experiments` (`experiments/spec-vs-vibe/compare.test.ts`).

| Implementation | Written from | Counterexamples / 400 |
|---|---|---|
| `@suture/formula` | the acceptance criteria of `.kiro/specs/formula-r1c1` | **0** (asserted) |
| "vibe" version | the prose of the brief (B.6), without the spec | **166 to 187** (not a fixed number) |

The corpus is drawn, not enumerated: the generator of
`experiments/spec-vs-vibe/compare.test.ts` is not seeded, and the test asserts
only that the prose-only version fails (`count > 0`) and logs the number it
measured. **187** was the count of the run kept during the build; three replay
runs of the same test measured 166, 180 and 168. The zero of the spec-driven
implementation is asserted, and it is the number that matters.

The failures of the prose-only version are exactly the cases the spec had
enumerated: sheet-qualified references (`Sheet2!B5` → `ShR[-2]C[26018]!…`),
structured references (`Table1[Amount]` → `TaR[-9]C[24159][Amount]`) and
external workbooks (`'[Book1.xlsx]Sheet1'!A1` → `'[BR[0]C[33035].xlsx]…'`).
The spec's value was not the algorithm — it was the **list of cases to fail
on**.

## 4. Steering that made the difference

- **`no-silent-loss.md`** — before it, the combine engine could drop a change
  when both sides touched the same cell. After it, every change lands in
  exactly one of three buckets (applied / decided / reported), and the property
  SUT-P-08 checks it automatically.
- **`product.md`** (vocabulary table) — moved the "no Git word in the interface"
  rule from review comments to a CI check (`scripts/vocabulary-guard.mjs`).
  It caught three real leaks during the build, including a package name in an
  import line.
- **`canonical-format.md`** — fixed the exact TSV shape of the cell view,
  which the diff engine and the combine engine both read; without it the two
  disagreed on escaping.
- **`ooxml.md`** — the OOXML traps (shared strings, shared formulas, calcChain,
  style-only cells) were listed there before the first line of code, and each
  one became a test.

## 5. Hooks — what they caught

| Hook | Trigger | What it caught |
|---|---|---|
| `vocabulary-guard` | file edited in `packages/ui/**` | A UI string containing "commit"; a package name in an import line (the guard now skips module specifiers) |
| `merge-properties` | file edited in `packages/diff/**` or `packages/merge/**` | The row-pairing bug of section 6 (a retyped row was split into a deletion and an insertion) |
| `fidelity-check` | file edited in `packages/ooxml-patch/**` | The patcher writing the workbook name file, which broke the "identical file" check of the store |
| `canonical-fresh` | spec task completed | A stale cell view after a derivation change |

Each hook has a CI mirror, because a file trigger only reacts to the agent's
own edits — the rule that matters is enforced on every push.

## 6. Property-based testing findings

Twelve properties, each automated with fast-check. The number of draws depends
on the cost of one draw: 300 for the pure formula conversions, 200 for the
archive round-trip, the patch properties and the two diff properties, 100 for
the canonical derivation, 80 for the four combine properties, and 12 for the
store sequences, which build real repositories. Every counterexample below was
found by a property while that property was being written.

**Method — how to replay.** One property is replayed with
`pnpm vitest run packages/<package>` (`pnpm vitest run packages/merge`,
`pnpm vitest run packages/diff`, …); the whole suite is `pnpm test:run`
(368 tests in 46 files, about 16 s on this machine). Two packages freeze their
seed so that a failure is reproducible — `packages/canonical` and
`packages/ooxml-patch`, both `20261111`, the latter overridable with
`SUTURE_FC_SEED`. The other properties draw a random seed at each run, and the
seeds of the failures found during the build were **not written down**: what
survives is the counterexample itself, frozen as a deterministic test that
replays the case on every run. The `Seed` column says which is which; the
`Frozen by` column gives the exact file.

| Property | Counterexample | Fix | Seed | Frozen by |
|---|---|---|---|---|
| SUT-P-03 | `LOG10(A1)` was read as the cell `G10` plus a row | The scanner now requires that the character before a reference is not an identifier character | not captured | `packages/formula/src/convert.test.ts` — "does not mistake a function name or a defined name for a reference" |
| SUT-P-03 | `Sheet2!B5` was rewritten, corrupting the sheet name | Sheet prefixes are protected segments, like strings and external workbooks | not captured | `packages/formula/src/convert.test.ts` — "converts a reference qualified by a local sheet" |
| SUT-P-03 | `R[-12]` was swallowed as a table reference (`R` + `[-12]`) | A bracketed signed number is not a table reference; the guard now excludes it, and an external-workbook bracket must hold a file name with an extension | not captured | `packages/formula/src/convert.test.ts` — `=SUM(R[-12]C:R[-1]C)` reads back as `=SUM(B2:B13)`; the guard itself is `packages/formula/src/protect.ts` |
| SUT-P-04 | The row signature included the cell address, so inserting a row changed every signature below it | The signature is keyed by column, never by address | not captured | `packages/diff/src/compare.test.ts` — "reports an inserted row and does not mark shifted cells as modified" |
| SUT-P-05 | A retyped row (three amounts out of five) was split into a deletion plus an insertion | "Shares at least half its cells" is positional, not by value (B.7) | not captured | `packages/diff/src/compare.test.ts` — "pairs a retyped row as modified, not as a deletion plus an insertion" |
| SUT-P-06 | `combine(O, A, O)` produced a patch | The carrier is compared with the incoming value first: when it already holds it, nothing is written | not captured | `packages/merge/src/merge.test.ts` — "produces no disagreement when both sides typed the same change", plus the property itself in `packages/merge/src/properties.prop.test.ts` |
| SUT-P-08 | The other side's changes were mapped with the origin's coordinates instead of the carrier's | The map is composed: other → origin → carrier | not captured | `packages/merge/src/cases.test.ts` — "carries the other side's change onto the carrier's row" (Paul's `B2` lands on `B3` of the file that inserted a row) |
| SUT-P-08 | A sheet present on one side only produced a patch on a sheet the carrier does not have | Such a sheet is listed in the report; the file is never rebuilt | not captured | **no deterministic test.** The fix lives in `packages/merge/src/sheet-plan.ts` and `packages/merge/src/plan.ts`, but the combine generators (`packages/merge/test/generators.ts`) only edit the cells of one sheet, so neither a unit test nor the property replays that case |
| SUT-P-09 | The first generators produced *unrelated* workbooks, so the property measured nothing | The generators now derive the sides from one base grid | not captured | `packages/merge/test/generators.ts` — the shape of the generators is the fix, and SUT-P-09 runs on it |
| SUT-P-12 | The branch reference was written outside `refs/heads/`, so the exported archive was not clonable | The branch is moved explicitly after each commit; the test now runs a real `git log` on the extracted archive | not captured | `packages/git-store/src/store.test.ts` — "produces an archive that Git can clone" |
| SUT-P-12 | The workbook name file made the tree differ between two identical workbooks | The name file is written from the stored name, so the trees match | not captured | `packages/git-store/src/store.test.ts` — "creates no version when the dropped file is identical" |

### Also found while writing the properties

These were not failures of a SUT-P property run: they were found while the
properties and their generators were being built. Each one is now a
deterministic test.

| Package | Defect | Fix | Frozen by |
|---|---|---|---|
| `@suture/canonical` (SUT-P-02) | The text of a `t="inlineStr"` cell was lost: `<is><t>Inline</t></is>` gave an empty value, because the text lives in the child `<t>` | `collectText()` gathers the descendant `<t>` elements and ignores `<rPh>` — the same walk as for the shared string table | `packages/canonical/src/canonical.test.ts` |
| `@suture/ooxml-io` (SUT-P-01) | The generator was wrong before the property was: a part name drawn from an alphabet that allowed a leading `.` produced a duplicated `xl/workbook.xml`, and the round-trip lost an entry | The generator excludes `xl/workbook.xml` from the drawn list and adds it exactly once | `packages/ooxml-io/src/round-trip.prop.test.ts` (fixed before the first recorded run) |
| `@suture/ooxml-patch` (SUT-P-10) | A patch deleting a cell in a row that does not exist yet created an empty `<row>` | The deletion is ignored when the row is absent | `packages/ooxml-patch/src/patch.test.ts` |
| `@suture/ooxml-patch` (SUT-P-10) | Two patches for the same cell were generated, which the patcher refuses with a typed error | The properties generate unique cells only | `packages/ooxml-patch/src/patch.test.ts` |
| `@suture/ooxml-patch` (SUT-P-10) | `<calcPr>` was rewritten by truncating the workbook XML after the element when it was not self-closing — the headless office suite then refused to open the file | The element is rewritten in place, and the smoke test opens the patched file with `soffice` | `packages/ooxml-patch/src/workbook-calcpr.test.ts`, `packages/ooxml-patch/src/smoke.test.ts` |
| `@suture/ooxml-patch` (SUT-P-10) | A formula such as `SUM(A1:R5)` was mistaken for an R1C1 reference and rewritten | The detection requires the column part of the token | `packages/ooxml-patch/src/refs.test.ts` |
| `@suture/ooxml-patch` (SUT-P-10) | `<dimension>` was looked up under the wrong attribute name, so it never widened | The attribute name is the one Excel writes | `packages/ooxml-patch/src/worksheet-shapes.test.ts` |

The per-package records, with the seeds that do exist, are in
`packages/canonical/PROPERTIES.md`, `packages/diff/PROPERTIES.md`,
`packages/formula/PROPERTIES.md`, `packages/merge/PROPERTIES.md`,
`packages/ooxml-io/PROPERTIES.md` and `packages/ooxml-patch/PROPERTIES.md`.
`@suture/git-store` has no `PROPERTIES.md`: its property and its runs are
described in `.kiro/specs/git-store/tasks.md` and in the table above.

## 7. MCP, powers, custom agents

- **Custom agents**: `reviewer.md` (read-only reviewer: contracts, vocabulary,
  no-silent-loss, code shape) and `tester.md` (properties only, no production
  code). Their permissions are written in the files.
- **Skill**: `suture-fixture` — how to build a synthetic workbook and its
  variants; the fixture builder it describes is deterministic.
- **MCP**: declared, unused (no server was needed).
- **Powers**: none installed; every need was covered by a skill or a hook.

## 8. What did not work (honest notes)

- **The queue is fragile under load.** On a machine shared with a dozen other
  repositories, the merge queue's own verification ran longer than the
  five-minute budget and the merge stalled. Fix: the CI was split into two
  parallel jobs (`ci` and `build`), each with its own budget, and the
  self-hosted workers were moved to a dedicated workstation for the pull
  request checks — the ten workers migrated from the dormant repository keep
  the nightly acceptance run.
- **`hashFiles()` failed on a self-hosted runner** ("Fail to hash files under
  directory"), which broke the "is there a workspace here?" guard. The guards
  now test the file's presence in the shell.
- **The first row-signature implementation** was wrong in a way no unit test
  could see: it only failed on workbooks where a row had been retyped. Only
  the property caught it — and it was caught the day it was written, not at
  the end.
- **Two agents stalled mid-way** (a provider that never answered again). The
  work was finished by hand, in the same worktrees, with the same briefs.
- **The pnpm installer refused to run** because a build script was not
  explicitly allowed. Declaring it (`ignoredBuiltDependencies`) made the
  install deterministic.
- **The `git` vocabulary leaked once into an import line** — the guard caught
  it, which showed the value of mirroring the hook in CI.
