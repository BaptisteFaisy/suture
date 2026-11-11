# Specification: OOXML Patch (Carrier-Based Cell Patching)

## Requirements

### Overview
The `ooxml-patch` module implements in-place patching of an existing OOXML (`.xlsx` / `.xlsm`) carrier package. Rather than reconstructing workbooks from scratch, Suture modifies only the specific cells and metadata required by a combine operation, preserving every untouched part (drawings, charts, pivot tables, macros, themes, printer settings, conditional styles) byte-for-byte.

### User Stories & Acceptance Criteria (EARS Notation)

#### SUT-F-22 / SUT-F-05: Carrier-Based Cell Patching
- **WHEN** a combine plan or cell update is applied to a carrier workbook,
  **THEN** the system SHALL mutate only worksheet XML files containing updated cells, leaving all other ZIP entries identical byte-for-byte to the carrier (SUT-P-10).
- **WHEN** updating cell values in a worksheet XML part:
  - **IF** the cell value is a number, **THEN** the system SHALL write a `<v>` child element containing the shortest decimal representation reproducing the float, with kind attribute unset or omitted (default number).
  - **IF** the cell value is text, **THEN** the system SHALL write an inline string element `<is><t xml:space="preserve">...</t></is>` with cell attribute `t="inlineStr"` and SHALL NOT mutate or append to `xl/sharedStrings.xml`.
  - **IF** the cell value is a boolean, **THEN** the system SHALL write attribute `t="b"` with `<v>1</v>` or `<v>0</v>`.
  - **IF** the cell value is an error, **THEN** the system SHALL write attribute `t="e"` with `<v>#ERR...</v>`.
  - **IF** the cell value is a formula, **THEN** the system SHALL write element `<f>...</f>`, omit any cached `<v>` result tag, and preserve existing cell style attribute `s="..."`.
- **WHERE** an existing cell already has an `s="..."` style attribute,
  **THEN** the system SHALL preserve the exact style index attribute untouched.
- **WHERE** a patched cell previously did not exist in the row,
  **THEN** the system SHALL insert the `<c>` element maintaining ascending column order within its `<row>` element.
- **WHERE** new rows are introduced,
  **THEN** the system SHALL insert `<row>` elements maintaining ascending row index `r="..."` order and omit or update the advisory `spans` attribute.

#### SUT-F-22 / SUT-N-02: Calculation Chain Invalidation & Force Recalculation
- **WHEN** any formula or cell value is patched in the carrier package,
  **THEN** the system SHALL:
  1. Remove `xl/calcChain.xml` from the ZIP parts.
  2. Remove the `<Override PartName="/xl/calcChain.xml" .../>` element from `[Content_Types].xml`.
  3. Remove the relationship referencing `calcChain.xml` from `xl/_rels/workbook.xml.rels` if present.
  4. Ensure `xl/workbook.xml` contains a `<calcPr>` element with attribute `fullCalcOnLoad="1"`.
- **IF** `xl/workbook.xml` already contains `<calcPr>`,
  **THEN** the system SHALL set or overwrite `fullCalcOnLoad="1"` on that existing element without duplicating it.
- **IF** `xl/workbook.xml` does not contain `<calcPr>`,
  **THEN** the system SHALL insert `<calcPr fullCalcOnLoad="1"/>` immediately before the `<sheets>` element or in valid schema sequence order.

#### SUT-F-06: Origin Marker Stamping & Reading
- **WHEN** the user exports or downloads a working copy for external modification,
  **THEN** the system SHALL stamp an origin marker inside `docProps/custom.xml` recording:
  - Custom property `SutureSourceVersion`: the hexadecimal Git commit SHA or version ID of the base version.
  - Custom property `SutureScenario`: the name of the active scenario (e.g. `hire-two-engineers` or `reference`).
- **IF** `docProps/custom.xml` does not exist in the carrier,
  **THEN** the system SHALL create `docProps/custom.xml`, add its relationship to `_rels/.rels` with type `http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties`, and add its MIME override to `[Content_Types].xml`.
- **WHEN** an externally edited workbook is imported back into Suture,
  **THEN** the system SHALL read `docProps/custom.xml` to detect the starting version and scenario.
- **IF** `docProps/custom.xml` is missing or lacks Suture custom properties (e.g. stripped by an incompatible spreadsheet editor),
  **THEN** the system SHALL prompt the user to designate the parent version manually.

#### SUT-P-10: Byte-for-Byte Non-Cell Part Invariance
- **WHEN** `patchWorkbook(carrierParts, plan)` is evaluated,
  **THEN** every part whose path is NOT in the set of touched worksheets, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `[Content_Types].xml`, `xl/calcChain.xml`, and `docProps/custom.xml` SHALL match the carrier's byte sequence with zero delta:
  $$\forall p \notin \text{TouchedParts},\quad \text{hash}(\text{result}[p]) == \text{hash}(\text{carrier}[p])$$

#### SUT-P-11: Round-Trip Re-reading Fidelity
- **WHEN** a patched workbook archive is re-read by the canonical derivation engine,
  **THEN** all applied cells SHALL yield exactly the target kind, input, and format specified in the patch plan.
- **WHEN** Excel, Apple Numbers, or LibreOffice opens the patched file,
  **THEN** the application SHALL open without file repair or corruption prompts and SHALL recalculate all formula cells on first load.
