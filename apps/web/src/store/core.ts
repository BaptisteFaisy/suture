/**
 * Core of the real store: the observable state, the registry of tracked
 * workbooks and the injected ports. Actions live in `actions.ts` and
 * `finalize.ts`; the contract object the screens consume is built in
 * `snapshot.ts`.
 */
import type { CellHistoryEntry } from "@suture/contracts";
import type { ComparisonView, CombineView, StoreAdapter, WorkbookSummary } from "./index";
import type { SessionState } from "./actions";
import { EMPTY_SESSION } from "./actions";
import type { AdapterDeps } from "./actions";
import type { Registry } from "./registry";
import { createRegistry } from "./registry";

export interface CoreState {
  session: SessionState;
  workbooks: WorkbookSummary[];
  status: "idle" | "loading" | "error";
  error: string | null;
  cellHistory: CellHistoryEntry[] | null;
  authorName: string;
  demoAvailable: boolean;
  comparison: ComparisonView | null;
  combine: CombineView | null;
}

export interface Core {
  deps: AdapterDeps;
  registry: Registry;
  state: CoreState;
  /** Replaces part of the state and notifies the subscribers. */
  set(patch: Partial<CoreState>): void;
  subscribe(listener: () => void): () => void;
  /** Builds the contract object the screens read. */
  snapshot(): StoreAdapter;
}

function summariesOf(records: { id: string; name: string; createdAt: number }[]): WorkbookSummary[] {
  return records.map((record) => ({
    id: record.id,
    name: record.name,
    versions: 0,
    scenarios: [],
    updatedAt: record.createdAt,
  }));
}

export function initialState(registry: Registry): CoreState {
  return {
    session: EMPTY_SESSION,
    workbooks: summariesOf(registry.list()),
    status: "idle",
    error: null,
    cellHistory: null,
    authorName: registry.author(),
    demoAvailable: true,
    comparison: null,
    combine: null,
  };
}

/** Creates the core: state, subscribers and the registry over the host. */
export function createCore(deps: AdapterDeps, build: (core: Core) => StoreAdapter): Core {
  const registry = createRegistry(deps.host);
  const listeners = new Set<() => void>();
  const core: Core = {
    deps,
    registry,
    state: initialState(registry),
    set: (patch) => {
      core.state = { ...core.state, ...patch };
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => build(core),
  };
  return core;
}

/** Runs an action, tracking status and translating any refusal. */
export async function guarded(
  core: Core,
  action: () => Promise<void>,
  translate: (key: string) => string,
): Promise<void> {
  core.set({ status: "loading", error: null });
  try {
    await action();
    core.set({ status: "idle" });
  } catch (error) {
    core.set({ status: "error", error: translate(messageKeyOf(error)) });
  }
}

function messageKeyOf(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string") return `error.${code}`;
  }
  if (error instanceof Error && error.message.startsWith("error.")) return error.message;
  return "error.generic";
}
