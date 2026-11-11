/**
 * Shared context of a store: the injected file system, the repository
 * directory, the clock and the author, plus the two operations every method
 * needs (writing a version, reading the version list).
 */
import git from "isomorphic-git";
import type {
  CanonicalWorkbook,
  CommitOutcome,
  NewVersionInput,
  VersionMeta,
} from "@suture/contracts";
import { deriveCanonical, serializeCellsTsv, serializeWorkbookJson } from "@suture/canonical";
import { readWorkbook } from "@suture/ooxml-io";
import { commitTree, headOf, toVersionMeta } from "./commit";
import type { SutureFs } from "./fs";
import { FORMAT_PATH, REFERENCE, WORKBOOK_JSON, WORKBOOK_META, formatJson, partPath, sheetFileName } from "./layout";
import { canonicalOf, readText } from "./read";
import { writeFiles, type TreeFile } from "./tree";

export interface StoreContext {
  fs: SutureFs;
  dir: string;
  now(): number;
  fallbackAuthor(): string;
  workbookName(): string;
  setWorkbookName(name: string): void;
  readCanonical(versionId: string): Promise<CanonicalWorkbook>;
  versionsOf(ref: string): Promise<VersionMeta[]>;
  commitFiles(
    input: NewVersionInput,
    parents: string[],
    ref: string,
  ): Promise<CommitOutcome>;
}

export interface StoreOptions {
  fs: SutureFs;
  dir: string;
  author?: string;
  now?: () => number;
}

/** Tags of the repository, indexed by the version they point at. */
async function tagsByOid(fs: SutureFs, dir: string): Promise<Map<string, string>> {
  const tags = await git.listTags({ fs, dir }).catch(() => [] as string[]);
  const milestones = new Map<string, string>();
  for (const tag of tags) {
    const oid = await headOf(fs, dir, tag);
    if (oid !== null) milestones.set(oid, tag);
  }
  return milestones;
}

/** Scenario name carried by a branch name. */
export function nameOfRef(ref: string): string {
  return ref === REFERENCE ? REFERENCE : ref.replace("scenario/", "");
}

/** All the files of one version: parts, cell views and metadata. */
export function versionFiles(
  parts: { path: string; data: Uint8Array }[],
  canonical: CanonicalWorkbook,
  workbookName: string,
): TreeFile[] {
  const files: TreeFile[] = [
    { path: FORMAT_PATH, data: formatJson() },
    { path: WORKBOOK_JSON, data: serializeWorkbookJson(canonical.meta) },
    {
      path: WORKBOOK_META,
      data: `${JSON.stringify({ name: workbookName }, null, 2)}\n`,
    },
  ];
  for (const part of parts) {
    files.push({ path: partPath(part.path), data: part.data });
  }
  for (const [order, sheet] of canonical.sheets.entries()) {
    files.push({ path: sheetFileName(order, sheet.meta.name), data: serializeCellsTsv(sheet) });
  }
  return files;
}

/** Reads the tracked workbook's name back from the reference head. */
export async function storedName(fs: SutureFs, dir: string): Promise<string | null> {
  const head = await headOf(fs, dir, REFERENCE);
  if (head === null) return null;
  try {
    const parsed = JSON.parse(await readText(fs, dir, head, WORKBOOK_META)) as { name?: string };
    return typeof parsed.name === "string" ? parsed.name : null;
  } catch {
    return null;
  }
}

/** Builds the shared context of a store. */
export function createContext(options: StoreOptions): StoreContext {
  const { fs, dir } = options;
  const now = options.now ?? (() => Date.now());
  let name = "workbook";

  const versionsOf = async (ref: string): Promise<VersionMeta[]> => {
    const log = await git.log({ fs, dir, ref }).catch(() => []);
    const milestones = await tagsByOid(fs, dir);
    return log.map((entry) =>
      toVersionMeta(entry.oid, entry.commit, nameOfRef(ref), milestones.get(entry.oid)),
    );
  };

  const commitFiles = async (
    input: NewVersionInput,
    parents: string[],
    ref: string,
  ): Promise<CommitOutcome> => {
    const { parts } = readWorkbook(input.file);
    const canonical = deriveCanonical(parts);
    const tree = await writeFiles(fs, dir, versionFiles(parts, canonical, name));
    const previous = await headOf(fs, dir, ref);
    if (previous !== null && parents.length <= 1) {
      const { commit } = await git.readCommit({ fs, dir, oid: previous });
      if (commit.tree === tree) return { unchanged: true };
    }
    const author = input.author.length > 0 ? input.author : options.author ?? "Suture user";
    const oid = await commitTree(fs, dir, {
      tree,
      message: input.note,
      author: { name: author, timestamp: now() },
      parents,
      ref,
    });
    const { commit } = await git.readCommit({ fs, dir, oid });
    return { version: toVersionMeta(oid, commit, nameOfRef(ref)) };
  };

  return {
    fs,
    dir,
    now,
    fallbackAuthor: () => options.author ?? "Suture user",
    workbookName: () => name,
    setWorkbookName: (next: string) => {
      name = next;
    },
    readCanonical: (versionId: string) => canonicalOf(fs, dir, versionId),
    versionsOf,
    commitFiles,
  };
}
