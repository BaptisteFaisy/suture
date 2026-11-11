/**
 * Writing a version's tree with the low-level object database: blobs first,
 * then trees bottom-up, so a version is a plain Git tree and `git log -p` on
 * `cells/` stays readable for a developer (B.6).
 */
import type { TreeEntry } from "isomorphic-git";
import type { SutureFs } from "./fs";

/** One file of a version: text or raw bytes. */
export interface TreeFile {
  path: string;
  data: Uint8Array | string;
}

function toBytes(data: Uint8Array | string): Uint8Array {
  return typeof data === "string" ? new TextEncoder().encode(data) : data;
}

interface Node {
  blobs: Map<string, Uint8Array>;
  trees: Map<string, Node>;
}

function emptyNode(): Node {
  return { blobs: new Map(), trees: new Map() };
}

/** Splits a flat file list into a directory hierarchy. */
export function toHierarchy(files: TreeFile[]): Node {
  const root = emptyNode();
  for (const file of files) {
    const segments = file.path.split("/");
    const name = segments.pop() ?? file.path;
    let node = root;
    for (const segment of segments) {
      let child = node.trees.get(segment);
      if (child === undefined) {
        child = emptyNode();
        node.trees.set(segment, child);
      }
      node = child;
    }
    node.blobs.set(name, toBytes(file.data));
  }
  return root;
}

/** Tree entries are sorted the way Git sorts them: directories get a "/". */
function sortKey(name: string, isTree: boolean): string {
  return isTree ? `${name}/` : name;
}

function sortedEntries(node: Node): { name: string; isTree: boolean }[] {
  const entries = [
    ...[...node.blobs.keys()].map((name) => ({ name, isTree: false })),
    ...[...node.trees.keys()].map((name) => ({ name, isTree: true })),
  ];
  return entries.sort((a, b) => {
    const ka = sortKey(a.name, a.isTree);
    const kb = sortKey(b.name, b.isTree);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/** Writes one directory level and returns its tree oid. */
export async function writeNode(
  fs: SutureFs,
  dir: string,
  node: Node,
): Promise<string> {
  const git = await import("isomorphic-git");
  const tree: TreeEntry[] = [];
  for (const entry of sortedEntries(node)) {
    if (entry.isTree) {
      const child = node.trees.get(entry.name);
      if (child === undefined) continue;
      const oid = await writeNode(fs, dir, child);
      tree.push({ mode: "40000", path: entry.name, oid, type: "tree" });
      continue;
    }
    const blob = node.blobs.get(entry.name);
    if (blob === undefined) continue;
    const oid = await git.writeBlob({ fs, dir, blob });
    tree.push({ mode: "100644", path: entry.name, oid, type: "blob" });
  }
  return git.writeTree({ fs, dir, tree });
}

/** Writes a whole version: returns the root tree oid. */
export async function writeFiles(
  fs: SutureFs,
  dir: string,
  files: TreeFile[],
): Promise<string> {
  return writeNode(fs, dir, toHierarchy(files));
}
