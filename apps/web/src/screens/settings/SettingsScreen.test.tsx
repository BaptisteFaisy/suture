// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { LangContext, type Lang } from "../../i18n/lang";
import { StoreContext, type StoreAdapter } from "../../store";
import { LAST_EXPORT_KEY } from "../../store/export-reminder";
import { SettingsScreen } from "./SettingsScreen";

/**
 * This jsdom environment comes without a localStorage (Node shadows it with an
 * undefined getter), so the test installs the shape `createBrowserHost` reads —
 * the same pattern storage-quota.test.ts uses for `navigator.storage`.
 */
const settingsValues = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => settingsValues.get(key) ?? null,
    setItem: (key: string, value: string) => {
      settingsValues.set(key, String(value));
    },
    removeItem: (key: string) => {
      settingsValues.delete(key);
    },
    clear: () => {
      settingsValues.clear();
    },
  },
});

function emptyStore(overrides: Partial<StoreAdapter> = {}): StoreAdapter {
  return {
    workbooks: [],
    status: "idle",
    error: null,
    demoAvailable: false,
    hasWorkbook: false,
    openWorkbook: () => undefined,
    trackFile: async () => undefined,
    loadDemo: async () => undefined,
    versions: [],
    scenarios: [],
    createScenario: async () => undefined,
    setMilestone: async () => undefined,
    restoreVersion: async () => undefined,
    exportBundle: async () => undefined,
    comparison: null,
    compare: async () => undefined,
    setComparisonFilter: () => undefined,
    combine: null,
    startCombine: async () => undefined,
    chooseDisagreement: () => undefined,
    finalizeCombine: async () => undefined,
    cellHistory: null,
    showCellHistory: async () => undefined,
    authorName: "Nadia",
    setAuthorName: () => undefined,
    exportEverything: async () => undefined,
    clearStorage: async () => undefined,
    ...overrides,
  };
}

function renderScreen(store: StoreAdapter, lang: Lang = "en") {
  const setLang = vi.fn();
  const tree: ReactElement = (
    <LangContext.Provider value={{ lang, setLang }}>
      <StoreContext.Provider value={store}>
        <SettingsScreen />
      </StoreContext.Provider>
    </LangContext.Provider>
  );
  render(tree);
  return setLang;
}

afterEach(() => {
  cleanup();
  settingsValues.clear();
});

describe("SettingsScreen — author name", () => {
  it("shows the name already saved", () => {
    renderScreen(emptyStore());
    const input = screen.getByLabelText(/Name written on the versions/) as HTMLInputElement;
    expect(input.value).toBe("Nadia");
  });

  it("saves the author name for the next versions", () => {
    const setAuthorName = vi.fn();
    renderScreen(emptyStore({ setAuthorName }));
    fireEvent.change(screen.getByLabelText(/Name written on the versions/), {
      target: { value: "Hugo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save the name" }));
    expect(setAuthorName).toHaveBeenCalledWith("Hugo");
    expect(screen.getByRole("status").textContent).toContain("Author name saved");
  });

  it("trims the name before saving it", () => {
    const setAuthorName = vi.fn();
    renderScreen(emptyStore({ setAuthorName }));
    fireEvent.change(screen.getByLabelText(/Name written on the versions/), {
      target: { value: "  Hugo  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save the name" }));
    expect(setAuthorName).toHaveBeenCalledWith("Hugo");
  });

  it("refuses an empty name and says why", () => {
    const setAuthorName = vi.fn();
    renderScreen(emptyStore({ setAuthorName }));
    fireEvent.change(screen.getByLabelText(/Name written on the versions/), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save the name" }));
    expect(setAuthorName).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Write a name");
  });

  it("saves the name in French too", () => {
    const setAuthorName = vi.fn();
    renderScreen(emptyStore({ setAuthorName }), "fr");
    fireEvent.change(screen.getByLabelText(/Nom écrit sur les versions/), {
      target: { value: "Hugo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le nom" }));
    expect(setAuthorName).toHaveBeenCalledWith("Hugo");
  });
});

describe("SettingsScreen — language", () => {
  it("offers the language choice without duplicating the shell wording", () => {
    const setLang = renderScreen(emptyStore());
    fireEvent.change(screen.getByLabelText("Interface language"), {
      target: { value: "fr" },
    });
    expect(setLang).toHaveBeenCalledWith("fr");
  });
});

describe("SettingsScreen — storage and export", () => {
  it("says plainly when the browser does not report the quota", () => {
    renderScreen(emptyStore());
    expect(
      screen.getByText(/does not report how much space is used/),
    ).toBeTruthy();
  });

  it("exports everything through the store", async () => {
    const exportEverything = vi.fn(async () => undefined);
    renderScreen(emptyStore({ exportEverything }));
    fireEvent.click(screen.getByRole("button", { name: "Export everything" }));
    expect(exportEverything).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Archive ready/)).toBeTruthy();
  });

  it("reports an export failure without erasing anything", async () => {
    const exportEverything = vi.fn(async () => {
      throw new Error("boom");
    });
    renderScreen(emptyStore({ exportEverything }));
    fireEvent.click(screen.getByRole("button", { name: "Export everything" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("The export failed");
  });

  it("asks for a confirmation before erasing everything", async () => {
    const clearStorage = vi.fn(async () => undefined);
    renderScreen(emptyStore({ clearStorage }));
    fireEvent.click(screen.getByRole("button", { name: "Erase everything" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Erase everything\?/)).toBeTruthy();
    expect(clearStorage).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Erase everything" }));
    expect(clearStorage).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/has been erased/)).toBeTruthy();
  });

  it("closes the erasure confirmation without erasing", () => {
    const clearStorage = vi.fn(async () => undefined);
    renderScreen(emptyStore({ clearStorage }));
    fireEvent.click(screen.getByRole("button", { name: "Erase everything" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(clearStorage).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("SettingsScreen — export reminder after thirty days (SUT-N-05)", () => {
  const DAY = 24 * 60 * 60 * 1000;

  it("reminds when the last export is older than thirty days", async () => {
    window.localStorage.setItem(LAST_EXPORT_KEY, String(Date.now() - 31 * DAY));
    renderScreen(emptyStore());
    const reminder = await screen.findByText(/It has been 31 days since your last export/);
    expect(reminder.getAttribute("role")).toBe("status");
  });

  it("reminds in French too", async () => {
    window.localStorage.setItem(LAST_EXPORT_KEY, String(Date.now() - 31 * DAY));
    renderScreen(emptyStore(), "fr");
    expect(
      await screen.findByText(/Cela fait 31 jours depuis votre dernier export/),
    ).toBeTruthy();
  });

  it("stays quiet when the last export is recent", () => {
    window.localStorage.setItem(LAST_EXPORT_KEY, String(Date.now() - 5 * DAY));
    renderScreen(emptyStore());
    expect(screen.queryByText(/since your last export/)).toBeNull();
  });

  it("stays quiet when nothing was ever exported", () => {
    renderScreen(emptyStore());
    expect(screen.queryByText(/since your last export/)).toBeNull();
  });

  it("clears the reminder once a new export was offered", async () => {
    window.localStorage.setItem(LAST_EXPORT_KEY, String(Date.now() - 31 * DAY));
    const exportEverything = vi.fn(async () => {
      // The real store stamps the export date through the host settings;
      // the fake does the same so the screen can re-read it.
      window.localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
    });
    renderScreen(emptyStore({ exportEverything }));
    expect(await screen.findByText(/It has been 31 days/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Export everything" }));
    await waitFor(() => {
      expect(screen.queryByText(/since your last export/)).toBeNull();
    });
  });
});
