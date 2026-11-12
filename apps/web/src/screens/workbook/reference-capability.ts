/**
 * Optional capability of the store: making a scenario the Reference.
 *
 * The frozen contract of screen 2 (`store/index.ts`) does not expose a setter
 * for the Reference yet — it only reports which scenario carries it. The screen
 * probes for the capability instead of inventing behaviour, and says plainly
 * that the action is unavailable when the store cannot do it.
 */
import type { StoreAdapter } from "../../store";

/** Name of the optional setter, aligned with the contract's verb style. */
export const REFERENCE_SETTER = "setReferenceScenario" as const;

export interface ReferenceCapableStore {
  setReferenceScenario(name: string): Promise<void>;
}

export function canSetReference(
  store: StoreAdapter,
): store is StoreAdapter & ReferenceCapableStore {
  const candidate = store as Partial<ReferenceCapableStore>;
  return typeof candidate[REFERENCE_SETTER] === "function";
}
