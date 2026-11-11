import { useState } from "react";
import type { StoreAdapter } from "../../store";
import type { ThreadVersion } from "./thread-layout";

/** Local state of screen 2: what is selected and what the user is told. */
export interface ScreenState {
  selectedId: string | null;
  milestoneFor: ThreadVersion | null;
  restoreFor: ThreadVersion | null;
  status: string | null;
  error: string | null;
}

const INITIAL: ScreenState = {
  selectedId: null,
  milestoneFor: null,
  restoreFor: null,
  status: null,
  error: null,
};

export interface WorkbookActions {
  state: ScreenState;
  select(id: string | null): void;
  askMilestone(version: ThreadVersion | null): void;
  askRestore(version: ThreadVersion | null): void;
  run(action: () => Promise<void>, success: string): Promise<void>;
  fail(message: string): void;
}

/**
 * One place for the state of screen 2 and for the store calls: every action
 * goes through `run`, so nothing can succeed or fail silently (SUT-P-08 spirit).
 */
export function useWorkbookScreen(
  store: StoreAdapter,
  fallbackError: string,
): WorkbookActions {
  const [state, setState] = useState<ScreenState>(INITIAL);

  const run = async (action: () => Promise<void>, success: string) => {
    setState((previous) => ({ ...previous, status: null, error: null }));
    try {
      await action();
      setState((previous) => ({ ...previous, status: success }));
    } catch {
      setState((previous) => ({
        ...previous,
        error: store.error ?? fallbackError,
      }));
    }
  };

  return {
    state,
    run,
    select: (id) => setState((previous) => ({ ...previous, selectedId: id })),
    askMilestone: (version) =>
      setState((previous) => ({ ...previous, milestoneFor: version })),
    askRestore: (version) =>
      setState((previous) => ({ ...previous, restoreFor: version })),
    fail: (message) =>
      setState((previous) => ({ ...previous, status: null, error: message })),
  };
}
