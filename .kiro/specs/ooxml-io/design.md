# Design: ooxml-io (and canonical view derivation)

## Overview

`packages/ooxml-io` handles OPC ZIP decompression/recompression, OOXML part
discovery, sheet identity resolution, and resource/security enforcement.
`packages/canonical` consumes `OoxmlArchive` and produces the deterministic
`CanonicalWorkbook` (`_workbook.json`, `cells/*.tsv`, `.suture/format.json`)
using `saxes` streaming XML parsing and `@suture/formula` for shared-formula
expansion and A1-to-R1C1 normalization.

Both packages are pure TypeScript, run inside Web Workers as well as Node 24
(Vitest), and maintain strict `< 500` lines per file and `< 50` lines per
function.

## Data Structures (`@suture/contracts` aligned)

```ts
export const OOXML_LIMITS = {
  MAX_DECOMPRESSED_BYTES: 50 * 1024 * 1024, // 50 MB
  MAX_CELLS: 1_000_000,
  MAX_ENTRIES: 10_000,
  MAX_COMPRESSION_RATIO: 100,
  RATIO_CHECK_MIN_BYTES: 1024 * 1024,
} as const;

export type OoxmlErrorCode =
  | 'ENCRYPTED_OR_LEGACY_OLE2'
  | 'CORRUPT_ZIP'
  | 'UNSUPPORTED_FORMAT'
  | 'LIMIT_EXCEEDED'
  | 'CELL_LIMIT_EXCEEDED'
  | 'UNSAFE_XML'
  | 'MALFORMED_XML';

export interface OoxmlArchive {
  /** Normalized forward-slash paths -> raw part bytes (sorted keys on serialize). */
  parts: Map<string, Uint8Array>;
  isMacroEnabled: boolean;
}

export interface SheetMeta {
  sheetId: number;       // Stable Excel sheetId from xl/workbook.xml
  name: string;
  order: number;         // 0-based index in workbook.xml
  state: 'visible' | 'hidden' | 'veryHidden';
  partPath: string;      // e.g. xl/worksheets/sheet1.xml
  tsvFile: string;       // e.g. 01-budget.tsv
}

export interface DefinedName {
  name: string;
  localSheetId?: number;
  formula: string;
}

export interface OriginMarker {
  baseVersionId: string;
  scenarioName: string;
}

export type CellKind = 'n' | 's' | 'b' | 'e' | 'f';

export interface CanonicalCell {
  ref: string;           // A1 address (uppercase, e.g. "B14")
  row: number;           // 1-based numeric row
  col: number;           // 1-based numeric col
  kind: CellKind;
  input: string;         // Literal value or R1C1 formula (unescaped in memory)
  cached: string;        // Formula cached result only; "" otherwise
  fmt: string;           // Number format string; "" when General
}

export interface CanonicalSheet {
  meta: SheetMeta;
  cells: CanonicalCell[]; // Sorted by (row asc, col asc)
}

export interface CanonicalWorkbook {
  formatVersion: 1;
  sheets: CanonicalSheet[];
  definedNames: DefinedName[];
  nonCellFingerprints: Map<string, string>; // partPath -> SHA-256 hex
  originMarker?: OriginMarker;
}
```

## Step-by-Step Algorithms

### 1. Safe Unzip (`unzipWorkbook(raw: Uint8Array)`)

1. Check magic bytes:
   - If bytes `[0..3]` equal `D0 CF 11 E0` -> throw `OoxmlError('ENCRYPTED_OR_LEGACY_OLE2')`.
   - If bytes `[0..1]` are not `50 4B` (`PK`) -> throw `OoxmlError('CORRUPT_ZIP')`.
2. Perform streaming/guarded unzip with `fflate.unzipSync` using a per-entry
   filter callback:
   - Increment entry counter; if `entries > MAX_ENTRIES`, abort with `LIMIT_EXCEEDED`.
   - Check declared uncompressed size (`file.originalSize`) and compressed size:
     accumulate `totalUncompressed += file.originalSize`; if `> MAX_DECOMPRESSED_BYTES`,
     abort with `LIMIT_EXCEEDED`.
   - If `file.originalSize > RATIO_CHECK_MIN_BYTES` and `file.size > 0` and
     `file.originalSize / file.size > MAX_COMPRESSION_RATIO`, abort with `LIMIT_EXCEEDED`.
   - Skip directory entries (`name.endsWith('/')`).
3. Post-decompression verification: sum actual `Uint8Array.byteLength` across
   all extracted parts; if `> MAX_DECOMPRESSED_BYTES`, abort with `LIMIT_EXCEEDED`.
4. Normalize paths (strip leading `./` or `/`, normalize `\` to `/`).
5. Validate OPC structure:
   - `[Content_Types].xml` and `xl/workbook.xml` must exist; reject `.xlsb`
     parts (`xl/worksheets/sheet*.bin`).
   - If `EncryptionInfo` or `EncryptedPackage` exists, throw
     `ENCRYPTED_OR_LEGACY_OLE2`.
   - Detect `isMacroEnabled` via `xl/vbaProject.bin` or macro-enabled content
     type in `[Content_Types].xml`.

### 2. Deterministic Zip (`zipParts(parts: Map<string, Uint8Array>)`)

1. Collect keys and sort lexicographically by UTF-16 code unit order.
2. Build an `fflate.Zippable` object with fixed `mtime: new Date(0)` (UTC epoch)
   and deterministic compression level (`level: 6`) so container generation is
   reproducible while preserving every part byte identically.
3. Call `fflate.zipSync(entries)` and return `Uint8Array`.

### 3. Safe XML Streaming (`parseXmlStream`)

- Wrap `saxes.SaxesParser({ xmlns: false, position: true })`.
- Hook `ondoctype`: if any entity declaration (`<!ENTITY`) appears in the
  doctype string, immediately throw `OoxmlError('UNSAFE_XML')`.
- Hook `onerror`: wrap into `OoxmlError('MALFORMED_XML')` with part path and
  line/column.

### 4. Canonical Derivation (`deriveCanonical(archive)`)

1. **Origin marker extraction & stripping**: inspect `docProps/custom.xml` (if
   present) for Suture properties (`SutureBaseVersion`, `SutureScenario`). Record
   into `originMarker` and omit Suture-specific properties when computing
   `nonCellFingerprints`.
2. **Workbook & relationships**:
   - Parse `xl/_rels/workbook.xml.rels` -> map `rId` to normalized target path.
   - Parse `xl/workbook.xml` -> ordered `SheetMeta[]` (`sheetId`, `name`,
     `order`, `state`, `partPath`) and `definedNames[]` (sorted deterministically
     when serialized to `_workbook.json`).
   - Generate deterministic TSV filenames: `String(order + 1).padStart(2, '0') + '-' + slugify(name) + '.tsv'`,
     disambiguating collisions by appending `-s<sheetId>`.
3. **Shared Strings (`xl/sharedStrings.xml`)**:
   - Stream `<si>` elements into `string[]`. Concatenate `<t>` directly under
     `<si>` or inside `<r><t>` rich-text runs (ignore `<rPh>` phonetic runs).
4. **Number Formats (`xl/styles.xml`)**:
   - Parse `<numFmts>` custom `numFmtId -> formatCode` map, merged with ECMA-376
     built-in format table (ids 0..49, omitting id `0` `General` as `""`).
   - Parse `<cellXfs><xf numFmtId="..."/>` index array to map cell `s="idx"` to
     resolved `fmt`.
5. **Worksheet streaming & shared formula expansion**:
   - Maintain `sharedMasters: Map<string, { masterRef: string; a1Formula: string }>`
     for `<f t="shared" si="k">text</f>` elements.
   - For each `<c r="ref" t="type" s="styleIdx">`:
     - Increment global `totalCells`; if `> MAX_CELLS`, throw `CELL_LIMIT_EXCEEDED`.
     - If `<f>` is present:
       - If `t="shared"` and `<f>` has body text: store in `sharedMasters.get(si)`,
         convert `a1Formula` to R1C1 at `ref` using `@suture/formula`.
       - If `t="shared"` and body is empty: look up `sharedMasters.get(si)`,
         convert master's `a1Formula` to R1C1 at `masterRef`, and reuse/re-anchor
         at `ref` (or translate offset `(row - masterRow, col - masterCol)` then
         convert to R1C1 at `ref`).
       - Otherwise (`normal` or `array`): convert `<f>` text to R1C1 at `ref`.
       - Record `cached` from `<v>` (formatted raw value, empty if absent).
     - Else if `<v>` or `<is>` is present:
       - `t="s"`: look up `sharedStrings[Number(v)]`.
       - `t="inlineStr"` or `t="str"`: extract plain text from `<is>` / `<v>`.
       - `t="b"`: normalize `"1"`/`"true"` -> `"TRUE"`, `"0"`/`"false"` -> `"FALSE"`.
       - `t="e"`: error string as-is (`#DIV/0!`, etc.).
       - Default/numeric (`t="n"` or omitted): parse IEEE-754 float with `Number(v)`
         and serialize via `String(num)` (ES shortest round-trip decimal), preserving
         special `-0` as `"0"`. Dates remain numbers with resolved `fmt`.
     - Else (style-only cell): skip!
   - Sort collected cells by `(row asc, col asc)` regardless of XML order.
6. **Non-cell fingerprints**:
   - Compute SHA-256 hex digest (sync pure-TS SHA-256 helper so derivation stays
     synchronous/worker-friendly) for every part except `xl/worksheets/*.xml`,
     `xl/sharedStrings.xml`, `xl/calcChain.xml`, and normalized `docProps/custom.xml`.
7. **TSV Serialization**:
   - Escape `\`, `\t`, `\n`, `\r` in `input`, `cached`, `fmt`.
   - Join `ref\tkind\tinput\tcached\tfmt` with `\n` trailing newline.

## Error Handling

All boundary errors extend `Error` as `OoxmlError` with `{ code: OoxmlErrorCode, partPath?: string, detail?: string }` so the UI can display localized non-jargon messages (`SUT-F-04`) without leaking stack traces.

## Testing Strategy

- **Unit tests (`*.test.ts`)**:
  - Reject OLE2 magic bytes, encrypted zip, missing `[Content_Types].xml`, `.xlsb`,
    XXE `<!ENTITY>`, oversized decompressed payload (> 50 MB), high compression
    ratio (> 100:1), > 10,000 entries, > 1,000,000 cells.
  - Verify shared string rich-text flattening, shared formula expansion across
    columns/rows, style-only cell omission, date serial + `fmt` retention, and
    origin marker stripping.
  - **Oracle cross-check**: parse fixture `.xlsx`/`.xlsm` files with `exceljs`
    (devDependency only) and assert cell values/formulas match `canonical` output.
- **Property tests (`*.prop.test.ts` with `fast-check`, ≥ 100 runs CI / 1,000 local)**:
  - **SUT-P-01**: generate random `Map<string, Uint8Array>` part maps ->
    assert `unzipWorkbook(zipParts(parts))` equals `parts` byte-for-byte.
  - **SUT-P-02**: generate synthetic workbooks (random sheets, values, shared
    strings, shared formulas) -> shuffle ZIP entry order randomly -> assert
    `deriveCanonical` produces byte-identical `_workbook.json` and `cells/*.tsv`.
  - Print failing seeds explicitly and log any counterexample in `KIRO_JOURNAL.md`.
