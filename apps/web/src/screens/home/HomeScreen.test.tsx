// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { LangContext } from "../../i18n/lang";
import { StoreContext, type StoreAdapter } from "../../store";
import { HomeScreen } from "./HomeScreen";

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
    authorName: "",
    setAuthorName: () => undefined,
    exportEverything: async () => undefined,
    clearStorage: async () => undefined,
    ...overrides,
  };
}

function renderScreen(store: StoreAdapter) {
  const tree: ReactElement = (
    <LangContext.Provider value={{ lang: "en", setLang: () => undefined }}>
      <StoreContext.Provider value={store}>
        <HomeScreen />
      </StoreContext.Provider>
    </LangContext.Provider>
  );
  render(tree);
}

afterEach(cleanup);

describe("HomeScreen — the drop zone", () => {
  it("hands the dropped file to the store and says it is tracked", async () => {
    const trackFile = vi.fn(async () => undefined);
    renderScreen(emptyStore({ trackFile }));
    const file = new File(["bytes"], "budget-2026.xlsx");
    fireEvent.change(screen.getByLabelText(/or choose a file/), {
      target: { files: [file] },
    });
    expect(trackFile).toHaveBeenCalledWith(file);
    expect(await screen.findByText(/is now a tracked workbook/)).toBeTruthy();
  });

  it("shows why the store refused a file", async () => {
    const trackFile = vi.fn(async () => {
      throw new Error("encrypted");
    });
    renderScreen(emptyStore({ trackFile, error: "This file is encrypted." }));
    const file = new File(["bytes"], "locked.xlsx");
    fireEvent.change(screen.getByLabelText(/or choose a file/), {
      target: { files: [file] },
    });
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("encrypted");
  });
});

describe("HomeScreen — the demo workbook", () => {
  it("stays disabled until the demo is available", () => {
    renderScreen(emptyStore());
    const button = screen.getByRole("button", {
      name: /Load the demo workbook/,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/once the engines are wired/)).toBeTruthy();
  });

  it("loads the demo through the store when it is available", () => {
    const loadDemo = vi.fn(async () => undefined);
    renderScreen(emptyStore({ demoAvailable: true, loadDemo }));
    fireEvent.click(screen.getByRole("button", { name: /Load the demo workbook/ }));
    expect(loadDemo).toHaveBeenCalledTimes(1);
  });

  it("falls back to the published demo trio and reports a missing publication", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404 }) as unknown as Response),
    );
    const trackFile = vi.fn(async () => undefined);
    const loadDemo = vi.fn(async () => {
      throw new Error("no demo in the store");
    });
    renderScreen(emptyStore({ demoAvailable: true, loadDemo, trackFile }));
    fireEvent.click(screen.getByRole("button", { name: /Load the demo workbook/ }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe(
      "the demo workbook is not published yet",
    );
    expect(trackFile).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
