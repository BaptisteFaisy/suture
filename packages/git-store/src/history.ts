/**
 * History operations: restoring a past version as a NEW version, naming a
 * version, walking the history of one cell, and exporting a clonable archive.
 */
import git from "isomorphic-git";
import type { CellHistoryEntry, CellRecord, VersionMeta } from "@suture/contracts";
import type { StoreContext } from "./context";
import { REFERENCE } from "./layout";
import { commitTree, headOf, toVersionMeta } from "./commit";
import { exportRepository } from "./export";

export interface HistoryOps {
  restore(versionId: string, note: string, author: string): Promise<VersionMeta>;
  setMilestone(versionId: string, name: string): Promise<void>;
  cellHistory(sheetId: number, ref: string): Promise<CellHistoryEntry[]>;
  exportBundle(): Promise<Uint8Array>;
}

/** Walks versions oldest first, keeping those where the cell's input changed. */
async function walkHistory(
  versions: VersionMeta[],
  sheetId: number,
  ref: string,
  readCanonical: StoreContext["readCanonical"],
): Promise<CellHistoryEntry[]> {
  const entries: CellHistoryEntry[] = [];
  let previous: CellRecord | null = null;
  for (const version of [...versions].reverse()) {
    const canonical = await readCanonical(version.id);
    const sheet = canonical.sheets.find((item) => item.meta.sheetId === sheetId);
    const cell = sheet?.cells.find((item) => item.ref === ref) ?? null;
    const changed = previous === null ? cell !== null : previous.input !== cell?.input;
    if (changed) {
      entries.push({
        versionId: version.id,
        author: version.author,
        timestamp: version.timestamp,
        note: version.note,
        before: previous,
        after: cell,
      });
    }
    previous = cell;
  }
  return entries.reverse();
}

/** The history-related part of the store contract. */
export function historyOps(ctx: StoreContext): HistoryOps {
  const { fs, dir } = ctx;
  return {
    async restore(versionId: string, note: string, author: string) {
      const { commit } = await git.readCommit({ fs, dir, oid: versionId });
      const head = await headOf(fs, dir, REFERENCE);
      const oid = await commitTree(fs, dir, {
        tree: commit.tree,
        message: note,
        author: { name: author, timestamp: ctx.now() },
        parents: head === null ? [] : [head],
        ref: REFERENCE,
      });
      const created = await git.readCommit({ fs, dir, oid });
      return toVersionMeta(oid, created.commit, REFERENCE);
    },

    async setMilestone(versionId: string, name: string) {
      await git.tag({ fs, dir, ref: name, object: versionId, force: true });
    },

    async cellHistory(sheetId: number, ref: string) {
      const versions = await ctx.versionsOf(REFERENCE);
      return walkHistory(versions, sheetId, ref, ctx.readCanonical);
    },

    exportBundle: () => exportRepository(fs, dir),
  };
}
