/**
 * Origin marker (SUT-F-06).
 *
 * A working copy leaves Suture stamped with two custom document properties:
 * the version it started from and the scenario it belongs to. When the file
 * comes back, Suture knows where it started.
 */
import type { OoxmlParts, OriginMarker } from "@suture/contracts";
import { escapeText, findElements, unescapeText } from "./xml";

/** Path of the custom document properties part. */
export const CUSTOM_PROPS_PATH = "docProps/custom.xml";

/** Path of the package relationships part. */
export const ROOT_RELS_PATH = "_rels/.rels";

/** Property holding the version the working copy started from. */
export const VERSION_PROPERTY = "SutureSourceVersion";

/** Property holding the scenario name. */
export const SCENARIO_PROPERTY = "SutureScenario";

/** Format identifier of the custom properties, fixed by the format. */
const FMTID = "{D5CDD505-2E9C-101B-9397-08002B2CF9AE}";

/** Namespace of the custom properties. */
const CUSTOM_PROPS_NS = "http://schemas.openxmlformats.org/officeDocument/2006/custom-properties";

/** Namespace of the variant types. */
const VT_NS = "http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes";

/** Relationship type of the custom properties part. */
const CUSTOM_PROPS_REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties";

/** Content type of the custom properties part. */
const CUSTOM_PROPS_TYPE =
  "application/vnd.openxmlformats-officedocument.custom-properties+xml";

/** Builds the XML of a fresh `docProps/custom.xml` holding the marker. */
export function buildCustomProps(marker: OriginMarker): string {
  const properties = [
    property(2, VERSION_PROPERTY, marker.versionId),
    property(3, SCENARIO_PROPERTY, marker.scenario ?? ""),
  ].join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<Properties xmlns="${CUSTOM_PROPS_NS}" xmlns:vt="${VT_NS}">${properties}</Properties>`
  );
}

function property(pid: number, name: string, value: string): string {
  return (
    `<property fmtid="${FMTID}" pid="${pid}" name="${name}">` +
    `<vt:lpwstr>${escapeText(value)}</vt:lpwstr></property>`
  );
}

/**
 * Writes the marker into an existing `docProps/custom.xml`, keeping the
 * properties Suture does not own.
 */
export function upsertMarker(xml: string, marker: OriginMarker): string {
  let result = upsertProperty(xml, VERSION_PROPERTY, marker.versionId);
  result = upsertProperty(result, SCENARIO_PROPERTY, marker.scenario ?? "");
  return result;
}

function upsertProperty(xml: string, name: string, value: string): string {
  const element = findProperty(xml, name);
  if (!element) {
    const fragment = property(nextPid(xml), name, value);
    const close = xml.lastIndexOf("</Properties>");
    if (close < 0) return xml;
    return xml.slice(0, close) + fragment + xml.slice(close);
  }
  const raw = xml.slice(element.start, element.end);
  const updated = /<vt:lpwstr>[\s\S]*<\/vt:lpwstr>/.test(raw)
    ? raw.replace(
        /<vt:lpwstr>[\s\S]*<\/vt:lpwstr>/,
        `<vt:lpwstr>${escapeText(value)}</vt:lpwstr>`,
      )
    : raw.replace(/>$/, `><vt:lpwstr>${escapeText(value)}</vt:lpwstr></property>`);
  return xml.slice(0, element.start) + updated + xml.slice(element.end);
}

function findProperty(xml: string, name: string) {
  return findElements(xml, "property").find(
    (element) => element.attrs.find((attr) => attr.name === "name")?.value === name,
  );
}

/** Next free property identifier: the format forbids reusing a `pid`. */
function nextPid(xml: string): number {
  const pids = findElements(xml, "property")
    .map((element) => Number(element.attrs.find((attr) => attr.name === "pid")?.value ?? "1"))
    .filter((pid) => Number.isFinite(pid));
  return pids.length === 0 ? 2 : Math.max(...pids) + 1;
}

/** Reads the marker back, or `null` when the properties are absent. */
export function readMarker(xml: string): OriginMarker | null {
  const version = readProperty(xml, VERSION_PROPERTY);
  if (version === null) return null;
  const scenario = readProperty(xml, SCENARIO_PROPERTY);
  return {
    versionId: version,
    scenario: scenario === null || scenario === "" ? undefined : scenario,
  };
}

function readProperty(xml: string, name: string): string | null {
  const element = findProperty(xml, name);
  if (!element) return null;
  const raw = xml.slice(element.innerStart, element.innerEnd);
  const match = /<vt:lpwstr>([\s\S]*)<\/vt:lpwstr>/.exec(raw);
  return match ? unescapeText(match[1] ?? "") : "";
}

/**
 * Writes the marker into the workbook, creating the part when it is missing
 * and declaring it in `[Content_Types].xml` and `_rels/.rels`.
 */
export function stampMarker(parts: OoxmlParts, marker: OriginMarker): OoxmlParts {
  const existing = findParts(parts, CUSTOM_PROPS_PATH);
  if (!existing) {
    return declareCustomProps(parts, buildCustomProps(marker));
  }
  const xml = upsertMarker(existing, marker);
  return replaceText(parts, CUSTOM_PROPS_PATH, xml);
}

/** Declares the custom properties part in the content types and the rels. */
export function declareCustomProps(parts: OoxmlParts, xml: string): OoxmlParts {
  let result = replaceText(parts, CUSTOM_PROPS_PATH, xml);
  const contentTypes = readText(result, "[Content_Types].xml");
  if (contentTypes !== null && !contentTypes.includes(CUSTOM_PROPS_PATH)) {
    const override = `<Override PartName="/${CUSTOM_PROPS_PATH}" ContentType="${CUSTOM_PROPS_TYPE}"/>`;
    result = replaceText(result, "[Content_Types].xml", insertBeforeClose(contentTypes, "override", override));
  }
  const rels = readText(result, ROOT_RELS_PATH);
  if (rels !== null && !rels.includes(CUSTOM_PROPS_PATH)) {
    const id = nextRelationshipId(rels);
    const relationship = `<Relationship Id="${id}" Type="${CUSTOM_PROPS_REL}" Target="${CUSTOM_PROPS_PATH}"/>`;
    result = replaceText(result, ROOT_RELS_PATH, insertBeforeClose(rels, "relationship", relationship));
  }
  return result;
}

function insertBeforeClose(xml: string, kind: string, fragment: string): string {
  const close = kind === "override" ? "</Types>" : "</Relationships>";
  const at = xml.lastIndexOf(close);
  return at < 0 ? xml : xml.slice(0, at) + fragment + xml.slice(at);
}

/** Next free relationship identifier of a relationships part. */
function nextRelationshipId(xml: string): string {
  const ids = [...xml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
  return `rId${ids.length === 0 ? 1 : Math.max(...ids) + 1}`;
}

function findParts(parts: OoxmlParts, path: string): string | null {
  return readText(parts, path);
}

function readText(parts: OoxmlParts, path: string): string | null {
  const part = parts.find((candidate) => candidate.path === path);
  return part ? new TextDecoder().decode(part.data) : null;
}

function replaceText(parts: OoxmlParts, path: string, text: string): OoxmlParts {
  const data = new TextEncoder().encode(text);
  const exists = parts.some((candidate) => candidate.path === path);
  if (!exists) return [...parts, { path, data }];
  return parts.map((part) => (part.path === path ? { path, data } : part));
}
