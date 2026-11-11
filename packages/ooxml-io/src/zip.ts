/**
 * Deterministic recompression of OOXML parts.
 *
 * Entries are written sorted by path, with a fixed timestamp and compression
 * level, so the same list of parts always produces the same bytes.
 */
import { Zip, ZipDeflate } from "fflate";
import type { OoxmlParts } from "@suture/contracts";
import { sortParts } from "./parts";

/** Fixed timestamp (the oldest one the ZIP format can store). */
const FIXED_MTIME = new Date(1980, 0, 1, 0, 0, 0);

/** Fixed compression level: same bytes for the same input, every time. */
const FIXED_LEVEL = 6;

/** Concatenate the chunks emitted by the streaming ZIP writer. */
function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Keep one part per path (the last one wins), so that recompressing a
 * workbook never writes two entries with the same name.
 */
function uniqueParts(parts: OoxmlParts): OoxmlParts {
  const byPath = new Map<string, OoxmlParts[number]>();
  for (const part of parts) byPath.set(part.path, part);
  return [...byPath.values()];
}

/**
 * Recompress a list of parts into a valid ZIP archive.
 *
 * Entries are sorted by path and written with a fixed timestamp, so the
 * output is deterministic: the same parts always give the same bytes.
 */
export function zipParts(parts: OoxmlParts): Uint8Array {
  const chunks: Uint8Array[] = [];
  const zip = new Zip((error, chunk) => {
    if (error) throw error;
    if (chunk) chunks.push(chunk);
  });
  for (const part of sortParts(uniqueParts(parts))) {
    const entry = new ZipDeflate(part.path, { level: FIXED_LEVEL });
    entry.mtime = FIXED_MTIME;
    zip.add(entry);
    entry.push(part.data, true);
  }
  zip.end();
  return concatChunks(chunks);
}
