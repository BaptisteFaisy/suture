/**
 * Deterministic ZIP step.
 *
 * The archive must be byte-identical for two builds of the same descriptor:
 * every entry therefore carries the same fixed modification time, the parts
 * are written in a stable order, and the clock never enters the output.
 */
import { zipSync } from "fflate";

// The ZIP entries carry a DOS timestamp read in the local time zone: forcing
// UTC keeps the bytes identical whatever the machine that builds them.
process.env.TZ = "UTC";

/**
 * Fixed modification time written in every ZIP entry.
 *
 * The date is a constant of the project (not the build clock), so two builds
 * of the same descriptor produce the very same bytes.
 */
export const FIXED_MTIME = new Date(Date.UTC(2026, 10, 11, 0, 0, 0));

/** Converts a text part into UTF-8 bytes. */
function toBytes(data) {
  return typeof data === "string" ? new TextEncoder().encode(data) : data;
}

/** Zips the parts into a deterministic archive. */
export function zipParts(parts) {
  const files = {};
  for (const part of parts) {
    files[part.path] = toBytes(part.data);
  }
  return zipSync(files, { level: 9, mtime: FIXED_MTIME });
}
