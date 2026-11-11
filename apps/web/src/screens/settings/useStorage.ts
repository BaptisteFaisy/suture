import { useEffect, useState } from "react";
import type { StoreAdapter } from "../../store";
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
}

export interface StorageActions extends StorageState {
  askPersistence(t: (key: string) => string): Promise<void>;
  exportEverything(t: (key: string) => string): Promise<void>;
  openClear(): void;
  closeClear(): void;
  clearEverything(t: (key: string) => string): Promise<void>;
}

/** All the storage behaviour of screen 6 in one hook, one funnel per action. */
export function useStorage(store: StoreAdapter): StorageActions {
  const [state, setState] = useState<StorageState>({
    quota: null,
    notice: null,
    error: null,
    busy: null,
    confirmClear: false,
    remind: false,
  });

  const refresh = async () => {
    const quota = await readStorageQuota();
    setState((previous) => ({ ...previous, quota, remind: shouldRemindExport(quota) }));
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    ...state,
    askPersistence: async (t) => {
      const granted = await requestPersistence();
      setState((previous) => ({
        ...previous,
        error: null,
        notice: granted ? t("storage.persisted") : t("storage.persistRefused"),
      }));
      await refresh();
    },
    exportEverything: async (t) => {
      setState((previous) => ({ ...previous, busy: "export", error: null, notice: null }));
      try {
        await store.exportEverything();
        setState((previous) => ({ ...previous, busy: null, notice: t("export.done") }));
      } catch {
        setState((previous) => ({ ...previous, busy: null, error: t("export.error") }));
      }
    },
    openClear: () => setState((previous) => ({ ...previous, confirmClear: true })),
    closeClear: () => setState((previous) => ({ ...previous, confirmClear: false })),
    clearEverything: async (t) => {
      setState((previous) => ({ ...previous, confirmClear: false, busy: "clear" }));
      try {
        await store.clearStorage();
        setState((previous) => ({ ...previous, busy: null, notice: t("storage.cleared") }));
        await refresh();
      } catch {
        setState((previous) => ({ ...previous, busy: null, error: t("error.generic") }));
      }
    },
  };
}
