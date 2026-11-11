/**
 * Suture's own document properties (`docProps/custom.xml`).
 *
 * Suture stamps an origin marker on the workbooks it writes. These properties
 * are not part of the business workbook: they are stripped before the
 * canonical view is derived, so two files that differ only by their origin
 * marker produce the very same `cells/` view.
 */
import { childrenNamed, parseXml } from "./xml";

/** Path of the custom document properties part. */
export const CUSTOM_PROPERTIES_PART_PATH = "docProps/custom.xml";

/** Prefix of every property Suture owns. */
export const SUTURE_PROPERTY_PREFIX = "Suture";

/** The origin marker stamped by Suture, when present. */
export interface OriginMarker {
  /** Version the workbook was derived from. */
  sourceVersionId?: string;
  /** Scenario the workbook belongs to. */
  scenario?: string;
}

/** One custom document property. */
export interface CustomProperty {
  name: string;
  value: string;
}

/** True when the property belongs to Suture (not to the business workbook). */
export function isSutureProperty(name: string): boolean {
  return name.toLowerCase().startsWith(SUTURE_PROPERTY_PREFIX.toLowerCase());
}

/** Reads the custom properties of a workbook. */
export function parseCustomProperties(xml: string): CustomProperty[] {
  const root = parseXml(xml);
  const properties: CustomProperty[] = [];
  for (const property of childrenNamed(root, "property")) {
    const name = property.attrs["name"];
    if (name === undefined) continue;
    properties.push({ name, value: property.text.trim() });
  }
  return properties;
}

/** The Suture origin marker of a workbook, if it carries one. */
export function readOriginMarker(xml: string): OriginMarker | undefined {
  const marker: OriginMarker = {};
  for (const property of parseCustomProperties(xml)) {
    if (!isSutureProperty(property.name)) continue;
    const key = property.name.toLowerCase();
    if (key.includes("scenario")) marker.scenario = property.value;
    else if (key.includes("version")) marker.sourceVersionId = property.value;
  }
  return marker.sourceVersionId === undefined && marker.scenario === undefined ? undefined : marker;
}

/**
 * Removes the Suture properties from a custom properties part.
 *
 * The part is returned unchanged when it carries no Suture property, and
 * `undefined` when nothing is left to keep.
 */
export function stripSutureProperties(xml: string): string | undefined {
  const properties = parseCustomProperties(xml);
  const kept = properties.filter((property) => !isSutureProperty(property.name));
  if (kept.length === properties.length) return xml;
  if (kept.length === 0) return undefined;
  const body = kept
    .map(
      (property, index) =>
        `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${index + 2}" name="${escapeAttribute(property.name)}">${escapeText(property.value)}</property>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">${body}</Properties>`;
}

/** Escapes an attribute value. */
function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

/** Escapes the text of a property value. */
function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
