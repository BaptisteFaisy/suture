/**
 * The two-way meeting (SUT-F-24): when the two sides share no known original,
 * the app does not refuse the comparison — it opens a session where every
 * difference is settled by hand. The session has the same shape as the one
 * `planCombine` builds, with an empty original, so the screens and the report
 * work unchanged.
 */
import type { CanonicalWorkbook, MergePlan } from "@suture/contracts";
import { planTwoWay } from "@suture/merge";
import type { AdapterDeps, SessionState } from "./actions";
import { resolveSide } from "./actions";
import type { SheetNames } from "./mappers";
import type { Engines } from "./ports";

/** Plans a two-way comparison of two versions with no known original. */
export type TwoWayPlanner = (a: CanonicalWorkbook, b: CanonicalWorkbook) => MergePlan;

/**
 * The usual dependencies, plus an optional two-way planner. A plain
 * `AdapterDeps` satisfies it: the real planner of `@suture/merge` is the
 * default, and a test (or the worker wiring) may inject its own.
 */
export interface TwoWayDeps extends Omit<AdapterDeps, "engines"> {
  engines: Engines & { planTwoWay?: TwoWayPlanner };
}

/**
 * Builds the session of a two-way meeting between two sides.
 *
 * The caller decides when to use it: `commonOrigin` returned null, so there is
 * no original to combine from and nothing is invented here — `sides.origin`
 * stays empty and the plan asks the user about every difference.
 */
export async function planWithoutOrigin(
  deps: TwoWayDeps,
  session: SessionState,
  sideA: string,
  sideB: string,
): Promise<SessionState> {
  if (session.store === null) return session;
  const a = resolveSide(session, sideA);
  const b = resolveSide(session, sideB);
  const [aView, bView] = await Promise.all([
    session.store.getCanonical(a),
    session.store.getCanonical(b),
  ]);
  const plan = (deps.engines.planTwoWay ?? planTwoWay)(aView, bView);
  return {
    ...session,
    plan,
    choices: {},
    sides: { origin: "", a, b },
    sheetNames: sheetNamesOf(plan.carrier === "A" ? aView : bView),
  };
}

/**
 * Sheet names of the carried file, keyed by sheet identifier — the labels the
 * disagreement list and the report show. Exported so the wiring can share one
 * mapping instead of keeping a private copy.
 */
export function sheetNamesOf(workbook: CanonicalWorkbook): SheetNames {
  const names: SheetNames = new Map();
  for (const sheet of workbook.meta.sheets) names.set(sheet.sheetId, sheet.name);
  return names;
}
