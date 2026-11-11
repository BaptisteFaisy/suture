/**
 * Browser storage of the tracked workbooks (SUT-N-05).
 * Everything is local: the app only asks the browser how much room is left and
 * whether the data may be kept without eviction.
 */

export interface StorageQuota {
  readonly usage: number;
  readonly quota: number;
  readonly persisted: boolean;
}

/** Ratio of the quota above which the app reminds the user to export. */
export const EXPORT_REMINDER_RATIO = 0.3;

interface StorageLike {
  estimate?(): Promise<{ usage?: number; quota?: number }>;
  persist?(): Promise<boolean>;
  persisted?(): Promise<boolean>;
}

function storageApi(): StorageLike | null {
  const api = typeof navigator === "undefined" ? undefined : navigator.storage;
  return api === undefined ? null : (api as StorageLike);
}

/** Pure rule: remind the user to export before 30 % of the quota is used. */
export function shouldRemindExport(quota: StorageQuota | null): boolean {
  if (quota === null || quota.quota <= 0) return false;
  return quota.usage / quota.quota >= EXPORT_REMINDER_RATIO;
}

/** Reads usage, quota and the persistence state; null when unsupported. */
export async function readStorageQuota(): Promise<StorageQuota | null> {
  const api = storageApi();
  if (api === null || api.estimate === undefined) return null;
  const estimate = await api.estimate();
  const persisted =
    api.persisted === undefined ? false : await api.persisted();
  return {
    usage: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
    persisted,
  };
}

/** Asks the browser to keep the tracked workbooks out of eviction. */
export async function requestPersistence(): Promise<boolean> {
  const api = storageApi();
  if (api === null || api.persist === undefined) return false;
  return api.persist();
}
