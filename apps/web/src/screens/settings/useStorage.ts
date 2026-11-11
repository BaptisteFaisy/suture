import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { StoreAdapter } from "../../store";
import { createBrowserHost } from "../../store/browserHost";
import {
  daysSinceExport,
  isExportOverdue,
  readLastExport,
} from "../../store/export-reminder";
import {
  readStorageQuota,
  requestPersistence,
  shouldRemindExport,
  type StorageQuota,
} from "./storage-quota";

/** What the storage panel needs to show and to do (SUT-N-05). */
export interface StorageState {
  quota: StorageQuota | null;
  notice: string | null;
  error: string | null;
  busy: "export" | "clear" | null;
  confirmClear: boolean;
  remind: boolean;
  /** Whole days since the last export; null when there was none. */
  daysSinceExport: number | null;
  /** True when the last export is older than thirty days. */
  exportOverdue: boolean;
}

export interface StorageActions extends StorageState {
  askPersistence(t: (key: string) => string): Promise<void>;
  exportEverything(t: (key: string) => string): Promise<void>;
  openClear(): void;
  closeClear(): void;
  clearEverything(t: (key: string) => string): Promise<void>;
}

/** The browser settings: the same store the app stamps the export date into. */
const browserSettings = createBrowserHost().settings;

type SetStorageState = Dispatch<SetStateAction<StorageState>>;
type Translate = (key: string) => string;

const INITIAL_STATE: StorageState = {
  quota: null,
  notice: null,
  error: null,
  busy: null,
  confirmClear: false,
  remind: false,
  daysSinceExport: null,
  exportOverdue: false,
};

/** Re-reads the quota and the last export date; derives the two reminders. */
async function refreshState(setState: SetStorageState): Promise<void> {
  const quota = await readStorageQuota();
  const lastExportAt = readLastExport(browserSettings);
  const now = Date.now();
  setState((previous) => ({
    ...previous,
    quota,
    remind: shouldRemindExport(quota),
    daysSinceExport: daysSinceExport(lastExportAt, now),
    exportOverdue: isExportOverdue(lastExportAt, now),
  }));
}

async function askBrowserPersistence(setState: SetStorageState, t: Translate): Promise<void> {
  const granted = await requestPersistence();
  setState((previous) => ({
    ...previous,
    error: null,
    notice: granted ? t("storage.persisted") : t("storage.persistRefused"),
  }));
  await refreshState(setState);
}

async function exportAll(
  store: StoreAdapter,
  setState: SetStorageState,
  t: Translate,
): Promise<void> {
  setState((previous) => ({ ...previous, busy: "export", error: null, notice: null }));
  try {
    await store.exportEverything();
    setState((previous) => ({ ...previous, busy: null, notice: t("export.done") }));
    // A fresh export was just offered: re-read the date so the reminder of
    // the last thirty days disappears as soon as it is stale.
    await refreshState(setState);
  } catch {
    setState((previous) => ({ ...previous, busy: null, error: t("export.error") }));
  }
}

async function clearAll(
  store: StoreAdapter,
  setState: SetStorageState,
  t: Translate,
): Promise<void> {
  setState((previous) => ({ ...previous, confirmClear: false, busy: "clear" }));
  try {
    await store.clearStorage();
    setState((previous) => ({ ...previous, busy: null, notice: t("storage.cleared") }));
    await refreshState(setState);
  } catch {
    setState((previous) => ({ ...previous, busy: null, error: t("error.generic") }));
  }
}

/** All the storage behaviour of screen 6 in one hook, one funnel per action. */
export function useStorage(store: StoreAdapter): StorageActions {
  const [state, setState] = useState<StorageState>(INITIAL_STATE);

  useEffect(() => {
    void refreshState(setState);
  }, []);

  return {
    ...state,
    askPersistence: (t) => askBrowserPersistence(setState, t),
    exportEverything: (t) => exportAll(store, setState, t),
    openClear: () => setState((previous) => ({ ...previous, confirmClear: true })),
    closeClear: () => setState((previous) => ({ ...previous, confirmClear: false })),
    clearEverything: (t) => clearAll(store, setState, t),
  };
}
