/**
 * Helpers around the OPC part list: lookup, replacement and text conversion.
 */
import type { OoxmlPart, OoxmlParts } from "@suture/contracts";

const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

/** Decodes a part as UTF-8 text. */
export function partToText(part: OoxmlPart): string {
  return decoder.decode(part.data);
}

/** Encodes text as a UTF-8 part body. */
export function textToPart(path: string, text: string): OoxmlPart {
  return { path, data: encoder.encode(text) };
}

/** Finds a part by path. */
export function findPart(parts: OoxmlParts, path: string): OoxmlPart | undefined {
  return parts.find((part) => part.path === path);
}

/**
 * Returns a copy of `parts` where the part at `path` holds `data`.
 * Untouched parts keep the very same `Uint8Array` instance.
 */
export function withPart(parts: OoxmlParts, path: string, data: Uint8Array): OoxmlParts {
  let replaced = false;
  const next = parts.map((part) => {
    if (part.path !== path) return part;
    replaced = true;
    return { path, data };
  });
  if (!replaced) next.push({ path, data });
  return next;
}

/** Returns a copy of `parts` without the part at `path`. */
export function withoutPart(parts: OoxmlParts, path: string): OoxmlParts {
  return parts.filter((part) => part.path !== path);
}

/** Sorts parts by path, ascending — the canonical order of an OPC package. */
export function sortParts(parts: OoxmlParts): OoxmlParts {
  return [...parts].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
