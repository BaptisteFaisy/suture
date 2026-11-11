import type { VersionMeta } from "@suture/contracts";

/** Index of versions by id, for walking ancestries. */
export type VersionIndex = Map<string, VersionMeta>;

export function indexVersions(versions: VersionMeta[]): VersionIndex {
  const index: VersionIndex = new Map();
  for (const version of versions) {
    index.set(version.id, version);
  }
  return index;
}

/** Every ancestor of a version, nearest first (breadth-first, cycle-safe). */
export function ancestorsOf(index: VersionIndex, id: string): string[] {
  const seen = new Set<string>([id]);
  const queue = [id];
  const ordered: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    const version = index.get(current);
    if (version === undefined) continue;
    for (const parent of version.parents) {
      if (seen.has(parent)) continue;
      seen.add(parent);
      ordered.push(parent);
      queue.push(parent);
    }
  }
  return ordered;
}

/**
 * The nearest common origin of two versions: the first ancestor of `a` that is
 * also an ancestor (or the version itself) of `b`. Returns null when the two
 * histories are unrelated — the caller then offers a two-way comparison
 * (SUT-F-24) instead of a three-way combine.
 */
export function commonOrigin(
  index: VersionIndex,
  aId: string,
  bId: string,
): string | null {
  if (aId === bId) return aId;
  const ancestorsOfB = new Set<string>([bId, ...ancestorsOf(index, bId)]);
  if (ancestorsOfB.has(aId)) return aId;
  for (const candidate of ancestorsOf(index, aId)) {
    if (ancestorsOfB.has(candidate)) return candidate;
  }
  return null;
}
