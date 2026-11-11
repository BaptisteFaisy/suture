/**
 * Package assembly — the OPC parts of a workbook.
 *
 * Produces the part list (path → bytes) that the zip step turns into a
 * `.xlsx` or a `.xlsm`. No ZIP logic here: the archive is built elsewhere.
 */
import { escapeXml, textNode, XML_DECLARATION } from "./xml.mjs";
import { buildSheet } from "./sheet.mjs";
import { buildStyles } from "./styles.mjs";

const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const SHEET_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";
const MACRO_CT = "application/vnd.ms-excel.sheet.macroEnabled.main+xml";

/** Builds the shared string table and the index of every text. */
export function buildSharedStrings(sheets) {
  const texts = [];
  const index = new Map();
  let references = 0;
  for (const sheet of sheets) {
    for (const cell of sheet.cells) {
      if (cell.kind !== "s") continue;
      references += 1;
      if (index.has(cell.value)) continue;
      index.set(cell.value, texts.length);
      texts.push(cell.value);
    }
  }
  const items = texts.map((text) => `<si>${textNode(text)}</si>`).join("");
  const xml =
    `${XML_DECLARATION}<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"` +
    ` count="${references}" uniqueCount="${texts.length}">${items}</sst>`;
  return { xml, index, count: texts.length };
}

/** Builds `xl/workbook.xml`: the sheet list and the calculation settings. */
function buildWorkbook(sheets) {
  const entries = sheets
    .map((sheet, index) => {
      const state = sheet.hidden ? ' state="hidden"' : "";
      return `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"${state}/>`;
    })
    .join("");
  return (
    `${XML_DECLARATION}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"` +
    ` xmlns:r="${OFFICE_REL}"><sheets>${entries}</sheets>` +
    `<calcPr calcId="171027" fullCalcOnLoad="1"/></workbook>`
  );
}

/** Builds `xl/_rels/workbook.xml.rels` for the sheet list and the shared parts. */
function buildWorkbookRels(sheetCount, extra) {
  const relations = [];
  for (let index = 0; index < sheetCount; index += 1) {
    relations.push(
      `<Relationship Id="rId${index + 1}" Type="${OFFICE_REL}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    );
  }
  let next = sheetCount + 1;
  for (const relation of extra) {
    relations.push(
      `<Relationship Id="rId${next}" Type="${relation.type}" Target="${relation.target}"/>${relation.extra ?? ""}`,
    );
    next += 1;
  }
  return `${XML_DECLARATION}<Relationships xmlns="${REL_NS}">${relations.join("")}</Relationships>`;
}

/** Builds `[Content_Types].xml` for the given parts. */
function buildContentTypes(descriptor, sheetCount, options) {
  const overrides = [];
  for (let index = 1; index <= sheetCount; index += 1) {
    overrides.push(`<Override PartName="/xl/worksheets/sheet${index}.xml" ContentType="${SHEET_CT}"/>`);
  }
  overrides.push(
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`,
  );
  if (options.sharedStrings) {
    overrides.push(
      `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>`,
    );
  }
  if (options.chart) {
    overrides.push(
      `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
      `<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
    );
  }
  overrides.push(
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>`,
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>`,
  );
  const workbookType = options.macro ? MACRO_CT : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
  overrides.push(`<Override PartName="/xl/workbook.xml" ContentType="${workbookType}"/>`);
  const defaults =
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    (options.macro
      ? '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/>'
      : "");
  return `${XML_DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defaults}${overrides.join("")}</Types>`;
}

/** Builds `_rels/.rels`: the package-level relationships. */
function buildRootRels() {
  const relations = [
    `<Relationship Id="rId1" Type="${OFFICE_REL}/officeDocument" Target="xl/workbook.xml"/>`,
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>`,
    `<Relationship Id="rId3" Type="${OFFICE_REL}/extended-properties" Target="docProps/app.xml"/>`,
  ];
  return `${XML_DECLARATION}<Relationships xmlns="${REL_NS}">${relations.join("")}</Relationships>`;
}

/** Builds `docProps/core.xml` with fixed timestamps (the build must be stable). */
function buildCoreProps(descriptor) {
  const stamp = "2026-11-11T00:00:00Z";
  return (
    `${XML_DECLARATION}<cp:coreProperties` +
    ` xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"` +
    ` xmlns:dc="http://purl.org/dc/elements/1.1/"` +
    ` xmlns:dcterms="http://purl.org/dc/terms/"` +
    ` xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${escapeXml(descriptor.name)}</dc:title>` +
    `<dc:creator>Suture</dc:creator><cp:lastModifiedBy>Suture</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified>` +
    `</cp:coreProperties>`
  );
}

/** Builds `docProps/app.xml` with the sheet names. */
function buildAppProps(sheets) {
  const titles = sheets.map((sheet) => `<vt:lpstr>${escapeXml(sheet.name)}</vt:lpstr>`).join("");
  return (
    `${XML_DECLARATION}<Properties` +
    ` xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"` +
    ` xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<Application>Suture fixture builder</Application>` +
    `<TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${titles}</vt:vector></TitlesOfParts>` +
    `</Properties>`
  );
}

/** Builds a minimal but valid chart part plus its drawing. */
export function buildChartParts(sheetName) {
  const chart =
    `${XML_DECLARATION}<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"` +
    ` xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"` +
    ` xmlns:r="${OFFICE_REL}"><c:chart><c:plotArea><c:layout/>` +
    `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>` +
    `<c:ser><c:idx val="0"/><c:order val="0"/>` +
    `<c:cat><c:strRef><c:f>${escapeXml(sheetName)}!$A$1:$A$4</c:f></c:strRef></c:cat>` +
    `<c:val><c:numRef><c:f>${escapeXml(sheetName)}!$B$1:$B$4</c:f></c:numRef></c:val>` +
    `</c:ser><c:axId val="111111111"/><c:axId val="222222222"/></c:barChart>` +
    `</c:plotArea><c:plotVisOnly val="1"/></c:chart></c:chartSpace>`;
  const drawing =
    `${XML_DECLARATION}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"` +
    ` xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"` +
    ` xmlns:r="${OFFICE_REL}"><xdr:twoCellAnchor>` +
    `<xdr:from><xdr:col>4</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>10</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>20</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
    `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr>` +
    `<xdr:cNvPr id="2" name="Chart 1"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
    `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
    `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId1"/>` +
    `</a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`;
  const drawingRels =
    `${XML_DECLARATION}<Relationships xmlns="${REL_NS}">` +
    `<Relationship Id="rId1" Type="${OFFICE_REL}/chart" Target="../charts/chart1.xml"/></Relationships>`;
  const sheetRels =
    `${XML_DECLARATION}<Relationships xmlns="${REL_NS}">` +
    `<Relationship Id="rId1" Type="${OFFICE_REL}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`;
  return { chart, drawing, drawingRels, sheetRels };
}

/** Builds a placeholder `xl/vbaProject.bin` (macro fixtures never run it). */
export function buildVbaProject() {
  // An OLE2 compound-file signature followed by deterministic filler: the
  // fixture proves the *part* travels unchanged, it is never interpreted.
  const bytes = new Uint8Array(512);
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  bytes.set(signature, 0);
  for (let index = 8; index < bytes.length; index += 1) bytes[index] = index % 251;
  return bytes;
}

/**
 * Builds every part of the workbook.
 *
 * Returns a list of `{ path, data }` in a stable order, ready for zipping.
 */
export function buildParts(descriptor) {
  const { options, sheets } = descriptor;
  const parts = [];
  const styles = buildStyles(sheets);
  const shared = options.sharedStrings ? buildSharedStrings(sheets) : { xml: null, index: new Map() };

  const context = {
    sharedStrings: options.sharedStrings,
    sharedStringIndex: (text) => {
      if (!shared.index.has(text)) shared.index.set(text, shared.index.size);
      return shared.index.get(text);
    },
    styleIndex: styles.styleIndex,
    withDrawing: false,
  };

  const sheetXmls = sheets.map((sheet, index) => {
    context.withDrawing = options.chart && index === 0;
    return buildSheet(sheet, context);
  });
  context.withDrawing = false;
  const extraRelations = [];
  if (options.sharedStrings) {
    extraRelations.push({ type: `${OFFICE_REL}/sharedStrings`, target: "sharedStrings.xml" });
  }
  extraRelations.push({ type: `${OFFICE_REL}/styles`, target: "styles.xml" });
  if (options.macro) {
    extraRelations.push({ type: "http://schemas.microsoft.com/office/2006/relationships/vbaProject", target: "vbaProject.bin" });
  }

  parts.push({ path: "[Content_Types].xml", data: buildContentTypes(descriptor, sheets.length, options) });
  parts.push({ path: "_rels/.rels", data: buildRootRels() });
  parts.push({ path: "docProps/app.xml", data: buildAppProps(sheets) });
  parts.push({ path: "docProps/core.xml", data: buildCoreProps(descriptor) });
  parts.push({ path: "xl/workbook.xml", data: buildWorkbook(sheets) });
  parts.push({ path: "xl/_rels/workbook.xml.rels", data: buildWorkbookRels(sheets.length, extraRelations) });

  sheetXmls.forEach((xml, index) => {
    parts.push({ path: `xl/worksheets/sheet${index + 1}.xml`, data: xml });
  });
  if (options.chart) {
    const chart = buildChartParts(sheets[0].name);
    parts.push({ path: "xl/charts/chart1.xml", data: chart.chart });
    parts.push({ path: "xl/drawings/drawing1.xml", data: chart.drawing });
    parts.push({ path: "xl/drawings/_rels/drawing1.xml.rels", data: chart.drawingRels });
    parts.push({ path: "xl/worksheets/_rels/sheet1.xml.rels", data: chart.sheetRels });
  }
  if (options.macro) {
    parts.push({ path: "xl/vbaProject.bin", data: buildVbaProject() });
  }
  if (options.sharedStrings) {
    parts.push({ path: "xl/sharedStrings.xml", data: shared.xml });
  }
  parts.push({ path: "xl/styles.xml", data: styles.xml });
  return parts;
}
