import { REFERENCE } from "./layout";

/** Branch name a scenario lives on. The reference scenario is the trunk. */
export function scenarioRef(name: string): string {
  return name === REFERENCE ? REFERENCE : `scenario/${name}`;
}

/** Scenario name of a branch. */
export function scenarioName(ref: string): string {
  return ref === REFERENCE ? REFERENCE : ref.replace("scenario/", "");
}
