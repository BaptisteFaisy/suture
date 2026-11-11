/**
 * Reading and stamping the origin marker on its own, outside a full patch.
 *
 * Useful for the import flow: when a file comes back, Suture reads the
 * marker to know which version it started from (SUT-F-06).
 */
import type { OoxmlParts, OriginMarker } from "@suture/contracts";
import { CUSTOM_PROPS_PATH, buildCustomProps, declareCustomProps, readMarker, upsertMarker } from "./custom-props";
import { findPart, partToText, sortParts, textToPart, withPart } from "./parts";

/** Reads the origin marker of a workbook, or `null` when it is absent. */
export function readOriginMarker(parts: OoxmlParts): OriginMarker | null {
  const part = findPart(parts, CUSTOM_PROPS_PATH);
  if (!part) return null;
  return readMarker(partToText(part));
}

/** Writes the origin marker into a workbook, creating the part if needed. */
export function stampOriginMarker(parts: OoxmlParts, marker: OriginMarker): OoxmlParts {
  const existing = findPart(parts, CUSTOM_PROPS_PATH);
  if (!existing) {
    return sortParts(declareCustomProps(parts, buildCustomProps(marker)));
  }
  const xml = upsertMarker(partToText(existing), marker);
  return sortParts(withPart(parts, CUSTOM_PROPS_PATH, textToPart(CUSTOM_PROPS_PATH, xml).data));
}
