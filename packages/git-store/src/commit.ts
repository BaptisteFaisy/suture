/**
 * Commit plumbing over the object database: a version is written as a tree,
 * then committed with an explicit tree oid. Writing objects directly (instead
 * of going through a working directory) is what makes two-parent combines and
 * byte-faithful restores simple.
 */
import git from "isomorphic-git";
import type { SutureFs } from "./fs";
import type { CommitOutcome, VersionMeta } from "@suture/contracts";
import { REFERENCE } from "./layout";

export interface AuthorInput {
  name: string;
  email?: string;
  timestamp: number;
}

function identity(author: AuthorInput) {
  const when = {
    name: author.name.length > 0 ? author.name : "Suture user",
    email: author.email ?? "suture@localhost",
    timestamp: Math.floor(author.timestamp / 1000),
    timezoneOffset: 0,
  };
  return { author: when, committer: when };
}

/** Creates a commit for a tree and moves the branch to it. */
export async function commitTree(
  fs: SutureFs,
  dir: string,
  options: {
    tree: string;
    message: string;
    author: AuthorInput;
    parents: string[];
    ref?: string;
  },
): Promise<string> {
  const branch = options.ref ?? REFERENCE;
  const oid = await git.commit({
    fs,
    dir,
    message: options.message,
    tree: options.tree,
    parent: options.parents,
    noUpdateBranch: true,
    ...identity(options.author),
  });
  // Move the branch ourselves: `commit` would otherwise write the ref outside
  // `refs/heads/`, which leaves HEAD unborn and the export unclonable.
  await git.branch({ fs, dir, ref: branch, object: oid, checkout: false, force: true });
  return oid;
}

/** Head of a scenario (branch), or null when the repository is empty. */
export async function headOf(
  fs: SutureFs,
  dir: string,
  ref: string,
): Promise<string | null> {
  try {
    return await git.resolveRef({ fs, dir, ref });
  } catch {
    return null;
  }
}

/** One version's metadata, read back from its commit object. */
export function toVersionMeta(
  oid: string,
  commit: {
    message: string;
    parent: string[];
    author: { name: string; timestamp: number };
  },
  scenario: string,
  milestone?: string,
): VersionMeta {
  const note = (commit.message.split("\n\n")[0] ?? commit.message).trim();
  return {
    id: oid,
    note,
    author: commit.author.name,
    timestamp: commit.author.timestamp * 1000,
    parents: commit.parent,
    scenario,
    milestone,
  };
}

/** Outcome helper: an unchanged workbook creates no version (SUT-F-03). */
export function unchanged(): CommitOutcome {
  return { unchanged: true };
}

/** Outcome helper: a new version. */
export function committed(version: VersionMeta): CommitOutcome {
  return { version };
}
