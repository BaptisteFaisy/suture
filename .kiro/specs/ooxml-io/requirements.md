# Requirements: ooxml-io (and canonical view derivation)

## Introduction

`ooxml-io` (paired with canonical view derivation in `@suture/canonical`) is the
OOXML ingestion, inspection, validation, and recompression boundary of Suture.
Every `.xlsx` and `.xlsm` file entering or leaving the browser passes through
this boundary. Its primary guarantees are byte-for-byte part fidelity on
round-trip (`SUT-P-01`), deterministic and archive-order-independent derivation
of the human- and Git-readable `cells/` view (`SUT-P-02`), and strict resource
and security guards against malformed, encrypted, or hostile archives (`SUT-F-04`,
`SUT-N-04`).

## Personas & User Stories

- **Nadia (volunteer treasurer)**: Drops `.xlsx` workbooks from colleagues and
  expects immediate, safe validation without installing software or leaking bytes
  over the network (`SUT-F-01`, `SUT-F-04`, `SUT-N-01`).
- **Hugo (management controller)**: Downloads tracked versions or working copies
  of 20-sheet `.xlsx`/`.xlsm` workbooks and expects every chart, style, and macro
  to survive intact (`SUT-F-05`, `SUT-N-02`).
- **Developer (counter-persona)**: Clones the exported Git history and inspects
  `cells/*.tsv` diffs; expects stable sorting, escaped text, and deterministic
  derivation regardless of which ZIP tool saved the workbook (`SUT-P-02`).

## Acceptance Criteria (EARS)

### Ingestion, Validation & Limits

1. **SUT-F-01 (Ingestion)** — WHEN the user drops a `.xlsx` or `.xlsm` buffer
   into Suture, the system SHALL decompress its OPC ZIP entries in-memory using
   `fflate` and return a normalized `OoxmlArchive` (`parts: Map<string, Uint8Array>`).
2. **SUT-F-04 (Encrypted / OLE2 rejection)** — IF the input buffer starts with
   the OLE2/CFB magic bytes (`D0 CF 11 E0`) or represents an encrypted OOXML
   package (`EncryptedPackage` / `EncryptionInfo`), THEN the system SHALL reject
   the file with a typed `OoxmlError('ENCRYPTED_OR_LEGACY_OLE2')` and explain
   that encrypted workbooks and legacy `.xls` files are not supported.
3. **SUT-F-04 (Unsupported format rejection)** — IF the archive lacks
   `[Content_Types].xml` or `xl/workbook.xml`, or declares `.xlsb` binary
   worksheet parts, THEN the system SHALL reject it with
   `OoxmlError('UNSUPPORTED_FORMAT')` and leave application state untouched.
4. **SUT-N-04 (Zip-bomb size & ratio guards)** — IF total decompressed bytes
   exceed `50 MB` (`52_428_800` bytes), OR total ZIP entries exceed `10_000`, OR
   any entry's compression ratio exceeds `100:1` above a `1 MB` threshold, THEN
   the system SHALL abort decompression immediately with
   `OoxmlError('LIMIT_EXCEEDED')`.
5. **SUT-F-04 (Cell count guard)** — IF parsed cells across all worksheets
   exceed `1_000_000`, THEN the system SHALL abort canonical derivation with
   `OoxmlError('CELL_LIMIT_EXCEEDED')` and report the exact sheet count/cell
   limit.
6. **SUT-N-04 (XXE & macro safety)** — WHILE parsing any XML part, the streaming
   parser (`saxes`) SHALL disable external entity resolution and reject `DOCTYPE`
   declarations with entity definitions; macro parts (`xl/vbaProject.bin`,
   `.xlsm` content types) SHALL be stored as opaque `Uint8Array` blobs and NEVER
   executed or interpreted.
7. **SUT-N-01 (Local-only processing)** — WHILE reading, validating, deriving,
   or zipping workbooks, the system SHALL perform zero network requests.

### Recompression & Round-Trip Fidelity

8. **SUT-F-05 / SUT-P-01 (Part-level zip round-trip)** — WHEN `zipParts(parts)`
   packs an `OoxmlArchive` and `unzipWorkbook(zipped)` unpacks it again, every
   part path and every byte of its `Uint8Array` payload SHALL be identical
   (`unzip(zip(parts)) == parts` byte-for-byte).
9. **SUT-F-05 (Macro-enabled preservation)** — WHERE the input archive contains
   `xl/vbaProject.bin` and macro-enabled content types, the system SHALL preserve
   those parts unmodified during round-trip.

### Deterministic Canonical Derivation

10. **SUT-P-02 (Determinism & ZIP order invariance)** — WHEN `deriveCanonical(parts)`
    is invoked on two archives with identical part bytes arranged in arbitrary
    ZIP entry orders, the produced `_workbook.json`, `cells/*.tsv`, and
    `.suture/format.json` SHALL be byte-for-byte identical.
11. **Canonical layout & sorting** — WHEN deriving `cells/*.tsv`, the system
    SHALL sort sheet files by workbook sheet order (`01-<slug>.tsv`, ...) and
    sort cell rows strictly by numeric row index ascending, then numeric column
    index ascending, with UTF-8 tab-separated columns
    `ref\tkind\tinput\tcached\tfmt`.
12. **Shared strings & rich text** — WHEN a cell has type `t="s"`, the system
    SHALL resolve its index against `xl/sharedStrings.xml`, flattening rich-text
    `<r><t>` runs into plain text and escaping `\`, `\t`, `\n`, and `\r`.
13. **Shared formula expansion** — WHEN a worksheet contains a shared formula
    master (`<f t="shared" ref="..." si="k">`) and follower cells
    (`<f t="shared" si="k"/>`), the system SHALL expand every follower into its
    own standalone formula using `@suture/formula` and emit it in R1C1 notation.
14. **Dates, numbers, styles, and origin markers** — WHEN deriving cells, the
    system SHALL keep dates as numeric serial values paired with their resolved
    number format code (`fmt`, omitted when `General`), write numbers in shortest
    round-trip decimal form, omit style-only cells without values, and strip
    Suture's own custom origin-marker properties before derivation.
15. **SUT-F-03 (Content equivalence)** — WHEN two `.xlsx` uploads differ only
    in ZIP timestamps, entry order, or Suture origin markers, their derived
    `cells/` and normalized `ooxml/` part hashes SHALL match so identical uploads
    are detected without creating empty versions.
