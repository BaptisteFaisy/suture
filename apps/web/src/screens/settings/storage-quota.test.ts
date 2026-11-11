// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EXPORT_REMINDER_RATIO,
  readStorageQuota,
  requestPersistence,
  shouldRemindExport,
  type StorageQuota,
} from "./storage-quota";

describe("shouldRemindExport (SUT-N-05)", () => {
  it("stays quiet below 30 % of the quota", () => {
    const quota: StorageQuota = { usage: 29, quota: 100, persisted: false };
    expect(shouldRemindExport(quota)).toBe(false);
  });

  it("reminds as soon as 30 % of the quota is reached", () => {
    const quota: StorageQuota = { usage: 30, quota: 100, persisted: true };
    expect(EXPORT_REMINDER_RATIO).toBe(0.3);
    expect(shouldRemindExport(quota)).toBe(true);
  });

  it("stays quiet when the browser reports no quota", () => {
    expect(shouldRemindExport(null)).toBe(false);
    expect(shouldRemindExport({ usage: 10, quota: 0, persisted: false })).toBe(false);
  });
});

describe("the browser storage API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "storage", {
      value: undefined,
      configurable: true,
    });
  });

  it("reads usage, quota and the persistence state", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        estimate: async () => ({ usage: 40, quota: 100 }),
        persisted: async () => true,
        persist: async () => true,
      },
    });
    expect(await readStorageQuota()).toEqual({
      usage: 40,
      quota: 100,
      persisted: true,
    });
    expect(await requestPersistence()).toBe(true);
  });

  it("reports nothing when the browser has no storage API", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: undefined,
    });
    expect(await readStorageQuota()).toBeNull();
    expect(await requestPersistence()).toBe(false);
  });
});
