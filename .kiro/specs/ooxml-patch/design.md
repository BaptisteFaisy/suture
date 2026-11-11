# Design: OOXML Patch

## Context

`packages/ooxml-patch` takes a **carrier** workbook (an already-unzipped OOXML
part map, produced by `@suture/ooxml-io`) and a patch plan produced by
`@suture/merge`, and returns a new part map where only the touched cells were
rewritten. The module never rebuilds a workbook: charts, drawings, pivot
tables, macros, themes and styles travel byte-for-byte (SUT-P-10).

Dependencies (acyclic, per `structure.md`):
`@suture/contracts`, `@suture/ooxml-io`, `@suture/formula`.

## Goals / Non-Goals

**Goals**
- Patch cell values, inline strings, booleans, errors and formulas in
  worksheet XML, preserving `s=` style indexes.
- Delete `xl/calcChain.xml`, its content-type override, its relationship, and
  force `fullCalcOnLoad="1"` in `xl/workbook.xml` `<calcPr>`.
- Write and read the origin marker in `docProps/custom.xml` (SUT-F-06).
- Guarantee SUT-P-10 (untouched parts identical) and SUT-P-11 (exact
  re-read) with fast-check property tests.

**Non-Goals**
- No SST mutation (shared string table stays intact).
- No formula recalculation (Excel recalculates on open).
- No macro parsing or execution (`.xlsm` parts carried as-is).
- No zip container byte fidelity (part-level fidelity is the contract).

## TypeScript Structures (aligned with `@suture/contracts`)

```ts
// packages/contracts/src/patch.ts — frozen interfaces
import type { CellKind } from './cell'; // 'n' | 's' | 'b' | 'e' | 'f'

/** One cell to write into the carrier. */
export interface CellPatch {
  readonly sheetPart: string;        // e.g. "xl/worksheets/sheet1.xml"
  readonly ref: string;              // e.g. "B14"
  readonly kind: CellKind;
  readonly input: string;            // value, or formula in A1 notation
                                     // (already shifted by @suture/formula)
  readonly fmt?: string;             // number format code (informational)
}

/** Origin marker written to / read from docProps/custom.xml. */
export interface OriginMarker {
  readonly sourceVersionId: string;  // Git commit SHA of the base version
  readonly scenario: string;         // scenario name, "reference" for main
}

/** Full description of one patch operation. */
export interface PatchPlan {
  readonly cells: readonly CellPatch[];
  readonly originMarker?: OriginMarker;   // stamped when present
  readonly forceFullRecalc: true;         // always true after a combine
}

/** Result of patching a carrier part map. */
export interface PatchResult {
  readonly parts: ReadonlyMap<string, Uint8Array>; // full output part map
  readonly touchedParts: readonly string[];        // paths actually rewritten
  readonly warnings: readonly PatchWarning[];
}

export type PatchWarning =
  | { readonly code: 'style-only-cell-overwritten'; readonly ref: string }
  | { readonly code: 'custom-props-replaced'; readonly part: string };
```

```ts
// packages/ooxml-patch/src/index.ts — public surface (< 50 lines each)
export function patchWorkbook(
  carrier: ReadonlyMap<string, Uint8Array>,
  plan: PatchPlan,
): PatchResult;

export function stampOriginMarker(
  parts: ReadonlyMap<string, Uint8Array>,
  marker: OriginMarker,
): ReadonlyMap<string, Uint8Array>;

export function readOriginMarker(
  parts: ReadonlyMap<string, Uint8Array>,
): OriginMarker | null;
```

## Module Layout (every file < 500 lines, every function < 50 lines)

```
packages/ooxml-patch/src/
  index.ts              public API (patchWorkbook, marker helpers)
  sheet-writer.ts       cell-level XML mutation of one worksheet part
  cell-xml.ts           serialize one <c> element per CellKind
  row-index.ts          row/cell ordered insertion, spans bookkeeping
  calc-chain.ts         calcChain removal + [Content_Types].xml override
  workbook-calcpr.ts    fullCalcOnLoad injection in xl/workbook.xml
  custom-props.ts       docProps/custom.xml read/write + rels + content types
  xml-scan.ts           minimal streaming tokenizer over saxes (no XXE)
```

## Algorithms

### 1. `patchWorkbook` (orchestrator)

1. Group `plan.cells` by `sheetPart`.
2. For each touched sheet part: decode bytes → run `sheet-writer` → encode.
   Untouched parts are passed through by reference (no copy, no re-encode).
3. Run `calc-chain.removeCalcChain(parts)` when any cell was patched.
4. Run `workbook-calcpr.ensureFullCalcOnLoad(parts)`.
5. If `plan.originMarker` is set, run `custom-props.writeMarker(parts, marker)`.
6. Return `{ parts, touchedParts, warnings }`.

### 2. Worksheet mutation (`sheet-writer`)

Streaming approach over the sheet XML with `saxes`, emitting an output buffer:

1. Walk `<sheetData>`; keep everything outside `<row>`/`<c>` verbatim.
2. For each target row number (ascending), locate or create the `<row>`:
   - existing row → rewrite only the targeted `<c>` children;
   - missing row → synthesize `<row r="N">` inserted in ascending order.
3. For each targeted `<c>` inside a row:
   - parse attributes; keep `s` (style index) if present;
   - replace children according to `CellKind` (see below);
   - keep cells in ascending column order (parse `ref` → column index).
4. `spans` attribute: dropped on touched rows (advisory only; Excel and
   LibreOffice tolerate its absence — cheaper and safer than recomputing).
5. Non-targeted `<c>` elements (including style-only `<c r="C5" s="12"/>`)
   are copied verbatim.

### 3. Cell serialization per kind (`cell-xml`)

| Kind | Output |
|---|---|
| `n` | `<c r="B2" s="7"><v>13500</v></c>` — shortest round-trip decimal (`Number.prototype.toString` in JS is shortest-round-trip for doubles) |
| `s` | `<c r="A2" s="7" t="inlineStr"><is><t xml:space="preserve">Loyer</t></is></c>` — XML-escaped text; SST untouched |
| `b` | `<c r="A3" t="b"><v>1</v></c>` |
| `e` | `<c r="A4" t="e"><v>#DIV/0!</v></c>` |
| `f` | `<c r="B14" s="7"><f>SUM(B2:B13)</f></c>` — formula text WITHOUT leading `=`, NO cached `<v>`; shared-formula attributes (`t="shared"`, `si`) removed on the patched cell |

R1C1 → A1 conversion happens upstream in `@suture/merge` via
`@suture/formula`; this module only receives A1-notation formulas at their
final carrier position.

### 4. Calc chain removal (`calc-chain`)

1. Delete entry `xl/calcChain.xml` from the part map.
2. In `[Content_Types].xml`, remove the `<Override>` whose `PartName`
   equals `/xl/calcChain.xml` (string-level removal of that element only).
3. In `xl/_rels/workbook.xml.rels`, remove any `<Relationship>` whose
   `Target` resolves to `calcChain.xml`.
4. If the part does not exist, steps are no-ops (idempotent).

### 5. `fullCalcOnLoad` (`workbook-calcpr`)

1. Parse `xl/workbook.xml` shallowly to find `<calcPr .../>` or
   `<calcPr ...></calcPr>`.
2. If found: set attribute `fullCalcOnLoad="1"` (replace if present).
3. If absent: insert `<calcPr calcId="0" fullCalcOnLoad="1"/>` at the
   schema-valid position (after `<definedNames>`/before `<oleSize>`; in
   practice immediately before `</workbook>` when those optional elements
   are absent — validated against the CT_Workbook sequence in tests).

### 6. Origin marker (`custom-props`)

Write:
1. If `docProps/custom.xml` exists, parse it and upsert two properties;
   else create it from a template with `pidBase="2"` incrementing.
2. Properties (type `lpwstr`):
   - `SutureSourceVersion` = `marker.sourceVersionId`
   - `SutureScenario` = `marker.scenario`
3. Ensure `_rels/.rels` has a relationship of type
   `.../relationships/custom-properties` targeting `docProps/custom.xml`.
4. Ensure `[Content_Types].xml` has the override
   `application/vnd.openxmlformats-officedocument.custom-properties+xml`.
5. Bump `fmtid` only for newly created properties; never reuse a `pid`.

Read:
1. Return `null` if the part, the relationship, or both properties are
   missing — the caller (import flow) then asks the user to designate the
   starting version (SUT-F-06 fallback).
2. `canonical` strips these properties before deriving `cells/`
   (derivation rule 7), so the marker never pollutes comparisons.

## Error Handling

| Situation | Behavior |
|---|---|
| Touched sheet part missing from carrier | Throw `PatchError('sheet-part-missing')`; caller aborts the combine, nothing is written |
| Malformed XML in a touched part (parse error) | Throw `PatchError('malformed-sheet-xml')` with part path; carrier parts returned unchanged by the caller |
| `ref` not a valid A1 address | Throw `PatchError('invalid-cell-ref')` — programming error, covered by types + zod at the boundary |
| Duplicate patch for same cell | Last-write-wins is forbidden: throw `PatchError('duplicate-cell-patch')` so the merge plan is fixed upstream |
| External entity encountered while parsing | Parser configured `resolveExternalEntities: false` → hard error (SUT-N-04, no XXE) |
| `docProps/custom.xml` present but unparsable | Emit warning `custom-props-replaced`, rewrite the part from template (no silent loss: warning surfaces in the combine report) |

No function swallows errors: every failure path throws a typed `PatchError`
with a stable `code`, mapped to a translated UI message by the caller.

## Testing Strategy

- **Unit (`*.test.ts`)**: golden XML fixtures per kind (number, inline
  string with `<`, `&`, newline; boolean; error; formula with and without
  pre-existing `<v>`; style preservation; row/cell insertion order;
  `spans` drop; calcChain trio; `calcPr` create/replace; custom props
  create/upsert/read/missing).
- **Property (`patch.prop.test.ts`, fast-check, seeds logged in
  `KIRO_JOURNAL.md`)**:
  - **SUT-P-10**: generate a carrier from the `fixtures/` corpus (charts,
    pivot, `.xlsm`), apply N random cell patches, assert every untouched
    part hashes identically (SHA-1 via `@suture/ooxml-io` fingerprint).
  - **SUT-P-11**: after patching, run `@suture/canonical` derivation on the
    result and assert each patched cell reads back with the exact kind,
    input (formulas compared after A1→R1C1 normalization) and fmt.
  - Round-trip marker: `readOriginMarker(stampOriginMarker(p, m)) === m`.
- **Smoke**: CI opens one patched fixture with a headless office suite when
  available on the runner (fallback: `exceljs` oracle read in tests only).
- **Hook `fidelity-check`**: on save under `packages/ooxml-patch/**`, runs
  SUT-P-10 over the fixture corpus.
- Limits: whole suite < 30 s, ≥ 100 fast-check runs in CI / 1000 locally,
  no network, no disk writes outside temp fixtures.
