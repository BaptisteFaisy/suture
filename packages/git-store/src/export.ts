/**
 * Exporting a tracked workbook: the repository itself, zipped, so a developer
 * can clone it and read the history of every cell with her own tools
 * (SUT-F-29). The archive root is the Git directory, so extracting it gives a
 * repository that `git clone` accepts.
 */
import { zipParts } from "@suture/ooxml-io";
import type { SutureFs } from "./fs";

interface WalkEntry {
  path: string;
  data: Uint8Array;
}

/** Recursively reads every file under `root`, with paths relative to it. */
export async function walkDirectory(
  fs: SutureFs,
  root: string,
  prefix = "",
): Promise<WalkEntry[]> {
  const entries = await fs.promises.readdir(root);
  const files: WalkEntry[] = [];
  for (const entry of entries) {
    const full = prefix.length === 0 ? `${root}/${entry}` : `${root}/${entry}`;
    const relative = prefix.length === 0 ? entry : `${prefix}/${entry}`;
    const stats = await fs.promises.stat(full);
    if (stats.isDirectory()) {
      files.push(...(await walkDirectory(fs, full, relative)));
      continue;
    }
    if (stats.isFile()) {
      const data = await fs.promises.readFile(full);
      files.push({ path: relative, data: asBytes(data) });
    }
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function asBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (typeof data === "string") return new TextEncoder().encode(data);
  return new Uint8Array(data as ArrayBuffer);
}

/** Zips the repository of a tracked workbook into a clonable archive. */
export async function exportRepository(fs: SutureFs, dir: string): Promise<Uint8Array> {
  const gitdir = `${dir}/.git`;
  const files = await walkDirectory(fs, gitdir);
  if (files.length === 0) {
    throw new Error("the repository is empty: nothing to export");
  }
  return zipParts(files);
}
