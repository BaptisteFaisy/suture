/**
 * The export reminder of SUT-N-05: the moment of the last export is kept in
 * the browser settings, so the rule stays true between two visits. Nothing
 * leaves the browser — the app only tells the user when the copy it holds is
 * getting old, and asks for a new export after thirty days.
 */
import type { HostPorts } from "./ports";

/** Key of the last export in the browser settings. */
export const LAST_EXPORT_KEY = "suture.lastExport";

/** Number of days after which the app asks for a new export. */
export const EXPORT_REMINDER_DAYS = 30;

/** The key/value store of the host, the one the settings are written through. */
export type SettingsStore = HostPorts["settings"];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Remembers the moment of the last export. */
export function writeLastExport(settings: SettingsStore, now: number): void {
  settings.set(LAST_EXPORT_KEY, String(Math.trunc(now)));
}

/** Reads the moment of the last export; null when there is none. */
export function readLastExport(settings: SettingsStore): number | null {
  const raw = settings.get(LAST_EXPORT_KEY);
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/** Whole days since the last export; null when there is none, never negative. */
export function daysSinceExport(lastExportAt: number | null, now: number): number | null {
  if (lastExportAt === null) return null;
  return Math.max(0, Math.floor((now - lastExportAt) / DAY_MS));
}

/** Pure rule: remind the user once the last export is older than thirty days. */
export function isExportOverdue(lastExportAt: number | null, now: number): boolean {
  if (lastExportAt === null) return false;
  return now - lastExportAt > EXPORT_REMINDER_DAYS * DAY_MS;
}
