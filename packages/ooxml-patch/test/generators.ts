/**
 * Test fixtures: synthetic OOXML carriers and fast-check arbitraries.
 *
 * The carriers are built in memory (no ZIP, no disk) so the tests stay fast
 * and hermetic. They mimic the traps listed in `.kiro/steering/ooxml.md`:
 * shared strings, shared formulas, style-only cells, a calculation chain,
 * charts, drawings and a VBA project.
 */
import type { CellRecord, OoxmlPart, OoxmlParts } from "@suture/contracts";
import fc from "fast-check";

/** One cell of a synthetic sheet. */
export interface FixtureCell {
  ref: string;
  /** Raw XML of the `<c>` element. */
  xml: string;
}

const CONTENT_TYPES_HEAD =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>';

const CONTENT_TYPES_TAIL = "</Types>";

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function part(path: string, text: string): OoxmlPart {
  return { path, data: bytes(text) };
}

/** Builds a worksheet part from a list of rows. */
export function buildSheet(rows: FixtureCell[][], extra = ""): OoxmlPart {
  const body = rows
    .map((cells, index) => {
      const rowNumber = index + 1;
      return `<row r="${rowNumber}" spans="1:3">${cells.map((cell) => cell.xml).join("")}</row>`;
    })
    .join("");
  const xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<dimension ref="A1:C${Math.max(rows.length, 1)}"/>${extra}` +
    `<sheetData>${body}</sheetData></worksheet>`;
  return part("xl/worksheets/sheet1.xml", xml);
}

/** Options of the synthetic carrier. */
export interface CarrierOptions {
  /** Adds `xl/vbaProject.bin` and the macro-enabled content type. */
  macroEnabled?: boolean;
  /** Adds `xl/calcChain.xml` with its override and relationship. */
  withCalcChain?: boolean;
  /** Adds `docProps/custom.xml` with its override and relationship. */
  withCustomProps?: boolean;
  /** Adds a chart and a drawing part. */
  withChart?: boolean;
}

/** Builds a complete synthetic carrier workbook. */
export function buildCarrier(options: CarrierOptions = {}): OoxmlParts {
  const parts: OoxmlPart[] = [];
  parts.push(part("[Content_Types].xml", contentTypes(options)));
  parts.push(part("_rels/.rels", rootRels(options)));
  parts.push(part("xl/workbook.xml", workbookXml()));
  parts.push(part("xl/_rels/workbook.xml.rels", workbookRels(options)));
  parts.push(buildSheet(defaultRows()));
  parts.push(part("xl/sharedStrings.xml", sharedStrings()));
  parts.push(part("xl/styles.xml", stylesXml()));
  parts.push(part("docProps/core.xml", coreXml()));
  parts.push(part("docProps/app.xml", appXml()));
  if (options.withCalcChain) parts.push(part("xl/calcChain.xml", calcChainXml()));
  if (options.withChart) {
    parts.push(part("xl/charts/chart1.xml", chartXml()));
    parts.push(part("xl/drawings/drawing1.xml", drawingXml()));
  }
  if (options.macroEnabled) {
    parts.push({ path: "xl/vbaProject.bin", data: new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3]) });
  }
  if (options.withCustomProps) parts.push(part("docProps/custom.xml", customPropsXml()));
  return parts.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function defaultRows(): FixtureCell[][] {
  return [
    [
      { ref: "A1", xml: '<c r="A1" s="1" t="s"><v>0</v></c>' },
      { ref: "B1", xml: '<c r="B1" s="2" t="s"><v>1</v></c>' },
    ],
    [
      { ref: "A2", xml: '<c r="A2" s="1" t="s"><v>2</v></c>' },
      { ref: "B2", xml: '<c r="B2" s="2"><v>13500</v></c>' },
    ],
    [
      { ref: "A3", xml: '<c r="A3" s="1"/>' },
      { ref: "B3", xml: '<c r="B3" s="2"><f t="shared" ref="B3:B4" si="0">SUM(B2:B2)</f><v>13500</v></c>' },
    ],
    [{ ref: "B4", xml: '<c r="B4" s="2"><f t="shared" si="0"/><v>27000</v></c>' }],
  ];
}

function contentTypes(options: CarrierOptions): string {
  let xml = CONTENT_TYPES_HEAD;
  xml +=
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>';
  if (options.withCalcChain) {
    xml +=
      '<Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/>';
  }
  if (options.withChart) {
    xml +=
      '<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>' +
      '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>';
  }
  if (options.macroEnabled) {
    xml +=
      '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/>';
  }
  if (options.withCustomProps) {
    xml +=
      '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>';
  }
  return xml + CONTENT_TYPES_TAIL;
}

function rootRels(options: CarrierOptions): string {
  let xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>';
  if (options.withCustomProps) {
    xml +=
      '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/>';
  }
  return xml + "</Relationships>";
}

function workbookXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Budget" sheetId="1" r:id="rId1"/></sheets>' +
    '<calcPr calcId="171027"/>' +
    "</workbook>"
  );
}

function workbookRels(options: CarrierOptions): string {
  let xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
  if (options.withCalcChain) {
    xml +=
      '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Target="calcChain.xml"/>';
  }
  if (options.withChart) {
    xml +=
      '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="drawings/drawing1.xml"/>';
  }
  return xml + "</Relationships>";
}

function sharedStrings(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="3" uniqueCount="3">' +
    "<si><t>Poste</t></si><si><t>Montant</t></si><si><t>Loyer</t></si></sst>"
  );
}

function stylesXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="1"><font><sz val="11"/></font></fonts>' +
    '<cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs>' +
    "</styleSheet>"
  );
}

function coreXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties">' +
    "<dc:creator>Nadia</dc:creator></cp:coreProperties>"
  );
}

function appXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">' +
    "<Application>Suture</Application></Properties>"
  );
}

function calcChainXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<c r="B3" i="1"/><c r="B4" i="1"/></calcChain>'
  );
}

function chartXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>'
  );
}

function drawingXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"/>'
  );
}

function customPropsXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" ' +
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Company"><vt:lpwstr>ACME</vt:lpwstr></property>' +
    "</Properties>"
  );
}

/** fast-check arbitrary for a carrier option set. */
export const carrierOptionsArb: fc.Arbitrary<CarrierOptions> = fc.record(
  {
    macroEnabled: fc.boolean(),
    withCalcChain: fc.boolean(),
    withCustomProps: fc.boolean(),
    withChart: fc.boolean(),
  },
  { requiredKeys: [] },
);

/** fast-check arbitrary for a cell kind. */
export const cellKindArb: fc.Arbitrary<CellRecord["kind"]> = fc.constantFrom("n", "s", "b", "e", "f");

/** fast-check arbitrary for a cell record (formula in A1 notation). */
export const cellRecordArb: fc.Arbitrary<CellRecord> = fc
  .tuple(cellKindArb, fc.string({ maxLength: 24 }))
  .map(([kind, raw]) => buildRecord(kind, raw));

function buildRecord(kind: CellRecord["kind"], raw: string): CellRecord {
  const text = raw.length === 0 ? "x" : raw;
  const input = inputFor(kind, text);
  return { ref: "", kind, input, cached: kind === "f" ? "0" : "", fmt: "" };
}

function inputFor(kind: CellRecord["kind"], text: string): string {
  switch (kind) {
    case "n":
      return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(text) ? text : String(text.length * 7 + 3);
    case "b":
      return text.length % 2 === 0 ? "true" : "false";
    case "e":
      return "#DIV/0!";
    case "f":
      return "SUM(B2:B13)";
    default:
      return text;
  }
}

/** fast-check arbitrary for a cell reference inside the fixture sheet. */
export const cellRefArb: fc.Arbitrary<string> = fc
  .tuple(fc.constantFrom("A", "B", "C", "D"), fc.integer({ min: 1, max: 6 }))
  .map(([column, row]) => `${column}${row}`);

/** fast-check arbitrary for one patch (record or deletion). */
export const patchArb = fc
  .tuple(cellRefArb, fc.option(cellRecordArb, { nil: null }))
  .map(([ref, record]) => ({
    sheetId: 1,
    ref,
    record: record === null ? null : { ...record, ref },
    source: "A" as const,
  }));

/** fast-check arbitrary for a sheet write (ref + record). */
export const sheetWriteArb = fc
  .tuple(cellRefArb, fc.option(cellRecordArb, { nil: null }))
  .map(([ref, record]) => ({ ref, record: record === null ? null : { ...record, ref } }));
