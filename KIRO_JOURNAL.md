# KIRO_JOURNAL — Suture (Kiroween 2026)

Running record of Kiro usage, kept for the submission form (Kiroween asks
precisely these questions). Entries are added as the work happens; the final
submission text is assembled from this file.

## 1. Overall strategy — how the work was split into specs

| Lot | Spec (`.kiro/specs/`) | Path | Why this order |
|---|---|---|---|
| B1 | `ooxml-io` | Requirements-first | Everything downstream reads parts; limits and refusals first |
| B1 | `formula-r1c1` | Requirements-first | Pure functions, ideal for the spec-vs-vibe comparison |
| B1 | `canonical` | Requirements-first | The cell view is the contract between diff and UI |
| B2 | `git-store` | Quick Spec | Bounded surface (versions, scenarios, export) |
| B3 | `diff-engine` | Requirements-first | ChangeSet feeds compare and combine |
| B4 | `ooxml-patch` | Requirements-first | Fidelity guarantee (SUT-P-10) is testable in isolation |
| B5 | `merge-engine` | Design-first | The architecture (carrier + alignment) commands everything |
| B6 | `compare-ui`, `merge-wizard` | Design-first | Screens shaped by the engines' outputs |

## 2. Surfaces used

| Surface | What it was used for | What worked | What was missing |
|---|---|---|---|
| IDE (specs) | Requirements → design → tasks per lot | EARS acceptance criteria carried straight from the brief | — |
| Steering | product / tech / structure / testing / no-silent-loss / ooxml / canonical-format | Vocabulary and fidelity rules held across sessions | — |
| Hooks | vocabulary-guard, merge-properties, fidelity-check, canonical-fresh | Command actions only (no credits consumed) | File triggers only see agent edits — hence the CI mirror |
| CLI headless | (optional) automated review in CI | Needs a paid API key | — |

## 3. Specs against "vibe coding"

| Function | Way | Duration | Back-and-forth | Defects found |
|---|---|---|---|---|
| `formula-r1c1` (A1 ↔ R1C1) | Spec-first | _to fill_ | _to fill_ | _to fill_ |
| same | Vibe coding | _to fill_ | _to fill_ | _to fill_ |

## 4. Steering that made the difference

- `no-silent-loss.md`: before it, the combine engine dropped changes when both
  sides edited the same cell; after it, every case maps to applied / decided /
  reported (property SUT-P-08).
- `product.md` vocabulary table: banned words moved from review comments into
  a CI check (`scripts/vocabulary-guard.mjs`).

## 5. Hooks — what they caught

| Hook | Trigger | Times fired | Example where it prevented a mistake |
|---|---|---|---|
| `vocabulary-guard` | file edited in `packages/ui/**` | _to fill_ | _to fill_ |
| `merge-properties` | file edited in `packages/diff/**`, `packages/merge/**` | _to fill_ | _to fill_ |
| `fidelity-check` | file edited in `packages/ooxml-patch/**` | _to fill_ | _to fill_ |
| `canonical-fresh` | spec task completed | _to fill_ | _to fill_ |

## 6. Property-based testing findings

| Property | Counterexample | Fix | Seed |
|---|---|---|---|
| _to fill_ | _to fill_ | _to fill_ | _to fill_ |

## 7. MCP, powers, custom agents

- Custom agents: `.kiro/agents/reviewer.md` (read-only reviewer) and
  `.kiro/agents/tester.md` (property tests only).
- Skills: `.kiro/skills/suture-fixture/SKILL.md` (build synthetic workbooks).
- MCP: declared in `.kiro/settings/mcp.json`.

## 8. What did not work (honest notes)

- _to fill as the work happens._
