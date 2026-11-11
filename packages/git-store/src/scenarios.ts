/**
 * Scenario operations: a scenario is a branch, a combine is a version with two
 * origins, a milestone is a tag. Nothing here ever rewrites history.
 */
import git from "isomorphic-git";
import type { CombineInput, CommitOutcome, ScenarioInfo } from "@suture/contracts";
import type { StoreContext } from "./context";
import { REFERENCE } from "./layout";
import { headOf } from "./commit";
import { scenarioName, scenarioRef } from "./refs";

export interface ScenarioOps {
  createScenario(name: string, fromVersion: string): Promise<ScenarioInfo>;
  listScenarios(): Promise<ScenarioInfo[]>;
  commitCombine(input: CombineInput): Promise<CommitOutcome>;
}

/** The scenario-related part of the store contract. */
export function scenarioOps(ctx: StoreContext): ScenarioOps {
  const { fs, dir } = ctx;
  return {
    async createScenario(name: string, fromVersion: string) {
      await git.branch({
        fs,
        dir,
        ref: scenarioRef(name),
        object: fromVersion,
        checkout: false,
        force: true,
      });
      return { name, head: fromVersion, reference: false };
    },

    async listScenarios() {
      const branches = await git.listBranches({ fs, dir });
      const scenarios: ScenarioInfo[] = [];
      for (const branch of branches) {
        const head = await headOf(fs, dir, branch);
        if (head === null) continue;
        scenarios.push({
          name: scenarioName(branch),
          head,
          reference: branch === REFERENCE,
        });
      }
      return scenarios.sort((a, b) => Number(b.reference) - Number(a.reference));
    },

    async commitCombine(input: CombineInput) {
      const ref = scenarioRef(input.scenario ?? REFERENCE);
      const note = `${input.note}\n\n${input.report}`;
      return ctx.commitFiles({ ...input, note }, [...input.parents], ref);
    },
  };
}
