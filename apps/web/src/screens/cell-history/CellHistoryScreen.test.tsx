// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { LangContext } from "../../i18n/lang";
import { NavigationContext, type Navigation, type ScreenParams } from "../../router";
import { StoreContext, type StoreAdapter } from "../../store";
import { CellHistoryScreen } from "./CellHistoryScreen";
import type { HistoryEntry } from "./cell-history-model";

/** Two changes of the cell B7. */
function history(): HistoryEntry[] {
  return [
    {
      versionId: "v2",
      author: "Marie",
      timestamp: Date.UTC(2026, 10, 9, 14, 5),
      note: "After the board meeting",
      before: { ref: "B7", kind: "n", input: "12000", cached: "", fmt: "" },
      after: { ref: "B7", kind: "n", input: "13500", cached: "", fmt: "" },
    },
    {
      versionId: "v1",
      author: "Nadia",
      timestamp: Date.UTC(2026, 10, 2, 9, 15),
      note: "First draft",
      before: { ref: "B7", kind: "n", input: "11000", cached: "", fmt: "" },
      after: { ref: "B7", kind: "n", input: "12000", cached: "", fmt: "" },
    },
  ];
}

/** A store holding a cell history. */
function fakeStore(entries: HistoryEntry[] | null): StoreAdapter {
  const base = {
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
    cellHistory: entries,
    showCellHistory: async () => undefined,
    authorName: "",
    setAuthorName: () => undefined,
    exportEverything: async () => undefined,
    clearStorage: async () => undefined,
  };
  return base as unknown as StoreAdapter;
}

/** Renders the screen with a cell chosen. */
async function renderScreen(
  store: StoreAdapter,
  params: ScreenParams = { sheetId: 1, ref: "B7" },
  lang: "en" | "fr" = "en",
): Promise<void> {
  const nav: Navigation = {
    screen: "cell-history",
    params,
    go: () => undefined,
    back: () => undefined,
  };
  const tree: ReactElement = (
    <LangContext.Provider value={{ lang, setLang: () => undefined }}>
      <NavigationContext.Provider value={nav}>
        <StoreContext.Provider value={store}>
          <CellHistoryScreen />
        </StoreContext.Provider>
      </NavigationContext.Provider>
    </LangContext.Provider>
  );
  render(tree);
  await screen.findByRole("heading", { name: /Cell history|Histoire de la cellule/ });
}

afterEach(cleanup);

describe("CellHistoryScreen", () => {
  it("lists the changes of the cell with author, date and note", async () => {
    await renderScreen(fakeStore(history()));
    const list = screen.getByTestId("history-list");
    expect(within(list).getByText("Marie")).toBeTruthy();
    expect(within(list).getByText("Nadia")).toBeTruthy();
    expect(within(list).getByText("After the board meeting")).toBeTruthy();
    expect(within(list).getByText("First draft")).toBeTruthy();
  });

  it("shows the values before and after each change", async () => {
    await renderScreen(fakeStore(history()));
    const list = screen.getByTestId("history-list");
    expect(within(list).getAllByText("12000")).toHaveLength(2);
    expect(within(list).getByText("11000")).toBeTruthy();
    expect(within(list).getByText("13500")).toBeTruthy();
  });

  it("counts the changes", async () => {
    await renderScreen(fakeStore(history()));
    expect(screen.getByTestId("history-count").textContent).toContain("2");
  });

  it("shows the empty state when the cell never changed", async () => {
    await renderScreen(fakeStore([]));
    expect(screen.getByText(/never been changed/)).toBeTruthy();
  });

  it("asks for a cell when none is chosen", async () => {
    await renderScreen(fakeStore(history()), {});
    expect(screen.getByText(/Choose a cell in the comparison grid/)).toBeTruthy();
  });

  it("speaks French when the interface is French", async () => {
    await renderScreen(fakeStore(history()), { sheetId: 1, ref: "B7" }, "fr");
    expect(screen.getByRole("heading", { name: "Histoire de la cellule" })).toBeTruthy();
    expect(screen.getByTestId("history-count").textContent).toContain("2");
  });
});
