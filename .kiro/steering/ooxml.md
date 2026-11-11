# Suture — OOXML Domain Knowledge

_Included conditionally on `packages/ooxml-io/**`, `packages/ooxml-patch/**` and `packages/canonical/**`._

## What a `.xlsx` file is

An OPC (Open Packaging Convention) ZIP archive containing XML parts. Key parts:

| Part | Role |
|---|---|
| `[Content_Types].xml` | MIME type of every part (must stay consistent when parts are added/removed) |
| `_rels/.rels` | Root relationships → points to `xl/workbook.xml` and `docProps/*` |
| `xl/workbook.xml` | Sheet list (`<sheet name sheetId r:id state>`), defined names, `calcPr` |
| `xl/_rels/workbook.xml.rels` | r:id → worksheet/sharedStrings/styles targets |
| `xl/worksheets/sheetN.xml` | The grid: `<row r=..><c r=.. t=.. s=..><f>..<v>..` |
| `xl/sharedStrings.xml` | Shared string table (SST), referenced by `t="s"` cells via `<v>index</v>` |
| `xl/styles.xml` | Number formats (`numFmts`), cell XFs (`s=` attribute indexes) |
| `xl/calcChain.xml` | Calculation order cache — **must be deleted** when cells are patched |
| `docProps/app.xml`, `docProps/core.xml` | Document properties; Suture adds two custom properties in `docProps/custom.xml` for the origin marker |
| `xl/charts/*`, `xl/pivotTables/*`, `xl/media/*`, `xl/vbaProject.bin` | Non-cell content: carried as-is, compared by fingerprint only |

## Known pitfalls (all hit in practice)

1. **Shared strings.** A cell with `t="s"` stores an *index*, not text. The
   canonical view must dereference. Inline strings use `t="inlineStr"` with
   `<is><t>`. Patched cells write **inline strings** and never touch the SST
   (appending to the SST would rewrite a shared part and break property SUT-P-10).
2. **Shared formulas.** `<f t="shared" ref="B2:B13" si="0">` defines a master;
   followers `<f t="shared" si="0"/>` have no text. Derivation must expand each
   follower by translating the master formula (this is exactly what R1C1 makes
   trivial).
3. **calcChain.** Excel's calc order cache. If cells are edited without updating
   it, Excel may show a repair prompt. Rule: delete `xl/calcChain.xml`, remove
   its `Override` from `[Content_Types].xml` and its relationship entry if any,
   and set `<calcPr fullCalcOnLoad="1"/>` in `xl/workbook.xml`.
4. **Booleans and errors.** `t="b"` (`<v>0|1</v>`), `t="e"` (`<v>#DIV/0!</v>`).
5. **Dates are numbers.** No date type exists: a date is a serial number with a
   date number format. The canonical view keeps the number + `fmt`.
6. **Style-only cells.** `<c r="C5" s="12"/>` with no value → omitted from
   `cells/`, but the `s` attribute must survive patching of neighbors.
7. **Row spans and ordering.** `<row>` elements should stay sorted by `r`;
   `spans` attribute is advisory — Excel tolerates wrong spans, LibreOffice too.
   When patching, update or drop `spans` on touched rows.
8. **Zip fidelity.** Re-zipping changes bytes (order, timestamps, compression).
   For *restore* we zip stored parts (content identical, container may differ
   byte-wise — that is acceptable: the OOXML **parts** are byte-identical). For
   *patch* we keep the carrier archive and replace only touched entries
   (fflate supports per-entry recompression via unzip/modify/zip of parts; the
   guarantee we make is at part level, SUT-P-10).
9. **Encrypted workbooks** are OLE2/CFB containers, not ZIP: detect the magic
   bytes (`D0 CF 11 E0`) and refuse with a clear message. Same for `.xls`
   (BIFF) and `.xlsb` (different content types).
10. **`.xlsm`**: identical structure + `xl/vbaProject.bin`. Carry the macro part
    as-is; never parse or execute it. Keep the `macroEnabled` content type.

## Sheet identity

`xl/workbook.xml` gives each sheet a stable `sheetId`; the file name
(`sheet1.xml`) can change when sheets are reordered/inserted by Excel. Match
sheets across versions by `sheetId` first, then by name (rename detection).
