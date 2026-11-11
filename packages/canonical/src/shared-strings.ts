/**
 * Shared strings table (`xl/sharedStrings.xml`).
 *
 * A cell with `t="s"` stores an index, not a text. Rich-text runs are
 * flattened to their plain text; phonetic runs (`<rPh>`) are ignored.
 */
import { childrenNamed, collectText, parseXml } from "./xml";

/** The shared strings of a workbook, in index order. */
export type SharedStrings = string[];

/** Reads the shared strings table from raw XML. */
export function parseSharedStrings(xml: string): SharedStrings {
  const root = parseXml(xml);
  const sst = root.name === "sst" ? root : (childrenNamed(root, "sst")[0] ?? root);
  return childrenNamed(sst, "si").map((si) => collectText(si));
}
