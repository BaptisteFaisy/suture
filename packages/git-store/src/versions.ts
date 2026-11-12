/**
 * Version operations: creating versions, listing them, reading their parts
 * and their canonical view, and restoring a past file byte-faithfully.
 */
import git from "isomorphic-git";
import type { CommitOutcome, NewVersionInput, VersionMeta } from "@suture/contracts";
import { zipParts } from "@suture/ooxml-io";
import type { StoreContext } from "./context";
import { storedName } from "./context";
import { REFERENCE } from "./layout";
import { partsOf } from "./read";
import { headOf, toVersionMeta } from "./commit";
import { scenarioRef } from "./refs";

export interface VersionOps {
  init(name: string): Promise<void>;
  commitVersion(input: NewVersionInput): Promise<CommitOutcome>;
  listVersions(scenario?: string): Promise<VersionMeta[]>;
  getVersion(id: string): Promise<VersionMeta>;
  getParts(versionId: string): ReturnType<typeof partsOf>;
  getCanonical(versionId: string): ReturnType<StoreContext["readCanonical"]>;
  restoreFile(versionId: string): Promise<Uint8Array>;
}

/** The version-related half of the store contract. */
export function versionOps(ctx: StoreContext): VersionOps {
  const { fs, dir } = ctx;
  return {
    async init(name: string) {
      ctx.setWorkbookName(name);
      const exists = await headOf(fs, dir, REFERENCE);
      if (exists !== null) {
        const stored = await storedName(fs, dir);
        if (stored !== null) ctx.setWorkbookName(stored);
        return;
      }
      await git.init({ fs, dir, defaultBranch: REFERENCE });
    },

    async commitVersion(input: NewVersionInput) {
      const ref = scenarioRef(input.scenario ?? REFERENCE);
      const head = await headOf(fs, dir, ref);
      return ctx.commitFiles(input, head === null ? [] : [head], ref);
    },

    listVersions: (scenario?: string) => ctx.versionsOf(scenarioRef(scenario ?? REFERENCE)),

    async getVersion(id: string) {
      const { commit } = await git.readCommit({ fs, dir, oid: id });
      return toVersionMeta(id, commit, REFERENCE);
    },

    getParts: (versionId: string) => partsOf(fs, dir, versionId),
    getCanonical: (versionId: string) => ctx.readCanonical(versionId),

    async restoreFile(versionId: string) {
      return zipParts(await partsOf(fs, dir, versionId));
    },
  };
}
