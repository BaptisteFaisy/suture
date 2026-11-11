/**
 * Calculation chain removal and recalculation request.
 *
 * Excel caches the calculation order in `xl/calcChain.xml`. When cells are
 * patched, that cache becomes wrong and Excel may ask to repair the file.
 * The fix is the one described in `.kiro/steering/ooxml.md`: drop the part,
 * drop its declaration in `[Content_Types].xml`, drop its relationship, and
 * ask for a full recalculation on load.
 */
import type { OoxmlParts } from "@suture/contracts";
import { findPart, partToText, textToPart, withPart, withoutPart } from "./parts";
import { findElements } from "./xml";

/** Path of the calculation chain part. */
export const CALC_CHAIN_PATH = "xl/calcChain.xml";

/** Path of the content types part. */
export const CONTENT_TYPES_PATH = "[Content_Types].xml";

/** Path of the workbook relationships part. */
export const WORKBOOK_RELS_PATH = "xl/_rels/workbook.xml.rels";

/** Path of the workbook part. */
export const WORKBOOK_PATH = "xl/workbook.xml";

/** Relationship type of the calculation chain. */
const CALC_CHAIN_REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain";

/** Removes the `<Override>` of the calculation chain from `[Content_Types].xml`. */
export function stripContentTypeOverride(xml: string): string {
  const overrides = findElements(xml, "Override");
  let result = xml;
  for (let index = overrides.length - 1; index >= 0; index -= 1) {
    const override = overrides[index];
    if (override === undefined) continue;
    const partName = override.attrs.find((attr) => attr.name === "PartName")?.value;
    if (partName !== `/${CALC_CHAIN_PATH}`) continue;
    result = result.slice(0, override.start) + result.slice(override.end);
  }
  return result;
}

/** Removes the calculation chain relationship from the workbook relationships. */
export function stripWorkbookRelationship(xml: string): string {
  const relationships = findElements(xml, "Relationship");
  let result = xml;
  for (let index = relationships.length - 1; index >= 0; index -= 1) {
    const relationship = relationships[index];
    if (relationship === undefined) continue;
    const type = relationship.attrs.find((attr) => attr.name === "Type")?.value;
    const target = relationship.attrs.find((attr) => attr.name === "Target")?.value ?? "";
    const isCalcChain = type === CALC_CHAIN_REL || target.endsWith("calcChain.xml");
    if (!isCalcChain) continue;
    result = result.slice(0, relationship.start) + result.slice(relationship.end);
  }
  return result;
}

/**
 * Drops the calculation chain and asks Excel for a full recalculation.
 * Every step is a no-op when the workbook has no calculation chain.
 */
export function removeCalcChain(parts: OoxmlParts): { parts: OoxmlParts; removed: boolean } {
  const chain = findPart(parts, CALC_CHAIN_PATH);
  let result = parts;
  if (chain) result = withoutPart(result, CALC_CHAIN_PATH);
  result = rewritePart(result, CONTENT_TYPES_PATH, stripContentTypeOverride);
  result = rewritePart(result, WORKBOOK_RELS_PATH, stripWorkbookRelationship);
  result = rewritePart(result, WORKBOOK_PATH, ensureFullCalcOnLoad);
  return { parts: result, removed: Boolean(chain) };
}

/** Applies `transform` to the part at `path`, when it exists. */
export function rewritePart(
  parts: OoxmlParts,
  path: string,
  transform: (xml: string) => string,
): OoxmlParts {
  const part = findPart(parts, path);
  if (!part) return parts;
  const xml = transform(partToText(part));
  if (xml === partToText(part)) return parts;
  return withPart(parts, path, textToPart(path, xml).data);
}

/**
 * Sets `fullCalcOnLoad="1"` on the `<calcPr>` element of the workbook.
 * The element is created when the workbook has none.
 */
export function ensureFullCalcOnLoad(xml: string): string {
  const calcPr = findElements(xml, "calcPr")[0];
  if (calcPr) return replaceCalcPr(xml, calcPr);
  const fragment = '<calcPr calcId="0" fullCalcOnLoad="1"/>';
  const at = insertionPoint(xml);
  if (at < 0) return xml;
  return xml.slice(0, at) + fragment + xml.slice(at);
}

function replaceCalcPr(xml: string, calcPr: { start: number; end: number }): string {
  const raw = xml.slice(calcPr.start, calcPr.end);
  if (/\bfullCalcOnLoad="[^"]*"/.test(raw)) {
    const withFlag = raw.replace(/\bfullCalcOnLoad="[^"]*"/, 'fullCalcOnLoad="1"');
    return xml.slice(0, calcPr.start) + withFlag + xml.slice(calcPr.end);
  }
  const tagEnd = raw.indexOf(">");
  if (tagEnd < 0) return xml;
  const selfClosing = raw[tagEnd - 1] === "/";
  const head = raw.slice(0, tagEnd - (selfClosing ? 1 : 0));
  const withFlag = `${head} fullCalcOnLoad="1"${selfClosing ? "/>" : ">"}`;
  return xml.slice(0, calcPr.start) + withFlag + xml.slice(calcPr.end);
}

/** Elements that come after `<calcPr>` in the CT_Workbook sequence. */
const AFTER_CALC_PR = [
  "oleSize",
  "customWorkbookViews",
  "pivotCaches",
  "smartTagPr",
  "webPublishing",
  "fileRecoveryPr",
  "webPublishObjects",
  "extLst",
];

/** Offset where `<calcPr>` may be inserted, keeping the schema order. */
function insertionPoint(xml: string): number {
  for (const tag of AFTER_CALC_PR) {
    const at = xml.indexOf(`<${tag}`);
    if (at >= 0) return at;
  }
  return xml.lastIndexOf("</workbook>");
}
