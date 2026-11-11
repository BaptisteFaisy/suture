/**
 * Store adapter — the single place where the UI meets the engines.
 *
 * The real implementation wires `@suture/git-store` (versions, scenarios,
 * export) over `@suture/ooxml-io` + `@suture/canonical`. Until the engines
 * land, the stub keeps the UI honest: empty states and a disabled demo.
 */
import { createContext, useContext } from "react";

export interface WorkbookSummary {
  id: string;
  name: string;
  versions: number;
  scenarios: string[];
  updatedAt: number;
}

export interface StoreAdapter {
  workbooks: WorkbookSummary[];
  status: "idle" | "loading" | "error";
  error: string | null;
  /** True once the demo workbook can be loaded. */
  demoAvailable: boolean;
  openWorkbook(id: string): void;
  trackFile(file: File): Promise<void>;
  loadDemo(): Promise<void>;
}

export const StoreContext = createContext<StoreAdapter | null>(null);

export function useStore(): StoreAdapter {
  const store = useContext(StoreContext);
  if (store === null) {
    throw new Error("useStore must be used inside StoreContext");
  }
  return store;
}
