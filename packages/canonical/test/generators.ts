/**
 * Synthetic OOXML parts for the tests.
 *
 * The helpers build small XML strings by hand: no fixture tool, no file
 * system, no network. They are intentionally dumb — they build exactly what a
 * test needs to state.
 */
import type { OoxmlPart } from "@suture/contracts";

/** Encodes a string as UTF-8 bytes. */
export function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/** One sheet of a synthetic workbook. */
export interface SheetFixture {
  /** Sheet name, as shown in the workbook. */
  name: string;
  /** Stable sheet id. */
  sheetId: number;
  /** Visibility state. */
  state?: "visible" | "hidden" | "veryHidden";
  /** Part path of the worksheet; defaults to `xl/worksheets/sheet<sheetId>.xml`. */
  path?: string;
  /** Body of the `<sheetData>` element. */
  rows: string;
}

/** One shared string of the synthetic workbook. */
export interface SharedStringFixture {
  /** Text of the entry; rich text is described by `runs`. */
  text?: string;
  /** Rich-text runs (`<r><t>`), when the entry is rich. */
  runs?: string[];
}

/** Description of a synthetic workbook. */
export interface WorkbookFixture {
  sheets: SheetFixture[];
  sharedStrings?: SharedStringFixture[];
  /** Custom number formats (`numFmtId` -> code). */
  numberFormats?: Record<string, string>;
  /** Number format id of each cell format (`cellXfs`), in order. */
  cellFormats?: number[];
  /** Defined names of the workbook. */
  definedNames?: string[];
  /** Extra parts, appended as-is. */
  extraParts?: OoxmlPart[];
}

/** Builds the parts of a synthetic workbook. */
export function buildWorkbookParts(fixture: WorkbookFixture): OoxmlPart[] {
  const parts: OoxmlPart[] = [];
  parts.push({ path: "[Content_Types].xml", data: text(contentTypes(fixture)) });
  parts.push({ path: "xl/workbook.xml", data: text(workbookXml(fixture)) });
  parts.push({ path: "xl/_rels/workbook.xml.rels", data: text(relationshipsXml(fixture)) });
  for (const sheet of fixture.sheets) {
    parts.push({ path: sheetPartPath(sheet), data: text(sheetXml(sheet)) });
  }
  if (fixture.sharedStrings && fixture.sharedStrings.length > 0) {
    parts.push({ path: "xl/sharedStrings.xml", data: text(sharedStringsXml(fixture.sharedStrings)) });
  }
  parts.push({ path: "xl/styles.xml", data: text(stylesXml(fixture)) });
  for (const extra of fixture.extraParts ?? []) parts.push(extra);
  return parts;
}

/** Part path of a sheet of the fixture. */
export function sheetPartPath(sheet: SheetFixture): string {
  return sheet.path ?? `xl/worksheets/sheet${sheet.sheetId}.xml`;
}

/** `[Content_Types].xml` of the fixture. */
function contentTypes(fixture: WorkbookFixture): string {
  const overrides = fixture.sheets
    .map(
      (sheet) =>
        `<Override PartName="/${sheetPartPath(sheet)}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${overrides}</Types>`;
}

/** `xl/workbook.xml` of the fixture. */
function workbookXml(fixture: WorkbookFixture): string {
  const sheets = fixture.sheets
    .map((sheet, index) => {
      const state = sheet.state === undefined ? "" : ` state="${sheet.state}"`;
      return `<sheet name="${sheet.name}" sheetId="${sheet.sheetId}" r:id="rId${index + 1}"${state}/>`;
    })
    .join("");
  const names = (fixture.definedNames ?? [])
    .map((name) => `<definedName name="${name}">${name}!$A$1</definedName>`)
    .join("");
  const defined = names === "" ? "" : `<definedNames>${names}</definedNames>`;
  return `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets>${defined}</workbook>`;
}

/** `xl/_rels/workbook.xml.rels` of the fixture. */
function relationshipsXml(fixture: WorkbookFixture): string {
  const sheetRels = fixture.sheets
    .map((sheet, index) => {
      const target = sheetPartPath(sheet).replace(/^xl\//, "");
      return `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${target}"/>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}</Relationships>`;
}

/** `xl/worksheets/sheetN.xml` of the fixture. */
function sheetXml(sheet: SheetFixture): string {
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet.rows}</sheetData></worksheet>`;
}

/** `xl/sharedStrings.xml` of the fixture. */
function sharedStringsXml(strings: SharedStringFixture[]): string {
  const items = strings
    .map((entry) => {
      if (entry.runs === undefined) return `<si><t>${entry.text ?? ""}</t></si>`;
      const runs = entry.runs.map((run) => `<r><t>${run}</t></r>`).join("");
      return `<si>${runs}</si>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${items}</sst>`;
}

/** `xl/styles.xml` of the fixture. */
function stylesXml(fixture: WorkbookFixture): string {
  const numFmts = fixture.numberFormats ?? {};
  const numFmtXml = Object.entries(numFmts)
    .map(([id, code]) => `<numFmt numFmtId="${id}" formatCode="${code}"/>`)
    .join("");
  const formats = numFmtXml === "" ? "" : `<numFmts count="${Object.keys(numFmts).length}">${numFmtXml}</numFmts>`;
  const xfs = (fixture.cellFormats ?? [0])
    .map((id) => `<xf numFmtId="${id}" fontId="0" fillId="0" borderId="0" xfId="0"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${formats}<cellXfs count="${(fixture.cellFormats ?? [0]).length}">${xfs}</cellXfs></styleSheet>`;
}
