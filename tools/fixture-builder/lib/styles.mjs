/**
 * Styles part — number formats and cell formats (xf records).
 *
 * Only what the fixtures need: one default cell format plus one format per
 * distinct number-format code found in the descriptor.
 */
import { escapeXml, XML_DECLARATION } from "./xml.mjs";

/** First custom number-format id; ids below are reserved by the spec. */
const FIRST_CUSTOM_FORMAT_ID = 164;

/** Collects the distinct number-format codes of every cell of the workbook. */
export function collectFormats(sheets) {
  const formats = [];
  const seen = new Set();
  for (const sheet of sheets) {
    for (const cell of sheet.cells) {
      if (!cell.format || seen.has(cell.format)) continue;
      seen.add(cell.format);
      formats.push(cell.format);
    }
  }
  return formats;
}

/** Builds the `numFmts` block, mapping each code to its format id. */
function buildNumFmts(formats) {
  const ids = new Map();
  const entries = formats.map((code, index) => {
    const id = FIRST_CUSTOM_FORMAT_ID + index;
    ids.set(code, id);
    return `<numFmt numFmtId="${id}" formatCode="${escapeXml(code)}"/>`;
  });
  const block = entries.length
    ? `<numFmts count="${entries.length}">${entries.join("")}</numFmts>`
    : "";
  return { block, ids };
}

/** Builds the `cellXfs` block: index 0 is General, then one xf per format. */
function buildCellXfs(ids, formats) {
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  for (const code of formats) {
    const numFmtId = ids.get(code);
    xfs.push(
      `<xf numFmtId="${numFmtId}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`,
    );
  }
  return `<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>`;
}

/**
 * Builds `xl/styles.xml` and returns the style index of every format code.
 * A cell without a format uses style 0 (General).
 */
export function buildStyles(sheets) {
  const formats = collectFormats(sheets);
  const { block, ids } = buildNumFmts(formats);
  const fonts =
    '<fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts>';
  const fills =
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>';
  const borders =
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>';
  const styleXfs = '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>';
  const cellStyles =
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>';
  const xml =
    `${XML_DECLARATION}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `${block}${fonts}${fills}${borders}${styleXfs}${buildCellXfs(ids, formats)}${cellStyles}</styleSheet>`;
  const styleIndex = new Map();
  formats.forEach((code, index) => styleIndex.set(code, index + 1));
  return { xml, styleIndex };
}
