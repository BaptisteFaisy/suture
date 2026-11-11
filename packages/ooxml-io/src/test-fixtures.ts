/**
 * Synthetic OOXML fixtures for the tests.
 *
 * Everything is built in memory: no file system, no network.
 */
import { zipSync } from "fflate";
import type { OoxmlPart } from "@suture/contracts";
import { zipParts } from "./zip";

/** Minimal content types manifest of a workbook. */
export const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>';

/** Minimal workbook part. */
export const WORKBOOK_XML =
  '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>';

/** Encode a string as UTF-8 bytes. */
export function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/** Build the parts of a minimal workbook, plus any extra part. */
export function workbookParts(extra: OoxmlPart[] = []): OoxmlPart[] {
  return [
    { path: "[Content_Types].xml", data: text(CONTENT_TYPES_XML) },
    { path: "xl/workbook.xml", data: text(WORKBOOK_XML) },
    ...extra,
  ];
}

/** Build the bytes of a minimal workbook archive. */
export function workbookBytes(extra: OoxmlPart[] = []): Uint8Array {
  return zipParts(workbookParts(extra));
}

/** Build a ZIP archive from arbitrary entries, without any guard. */
export function rawZip(entries: Record<string, Uint8Array>): Uint8Array {
  return zipSync(entries);
}
