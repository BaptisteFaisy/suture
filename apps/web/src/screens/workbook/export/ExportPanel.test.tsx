// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { LangContext } from "../../../i18n/lang";
import { StoreContext, type StoreAdapter } from "../../../store";
import { WorkbookScreen } from "../WorkbookScreen";
import { ExportPanel } from "./ExportPanel";
import { exportMessages, translateExport } from "./messages";

/** The smallest store that can render the panel. */
function store(overrides: Partial<StoreAdapter> = {}): StoreAdapter {
  return {
    workbooks: [],
    status: "idle",
    error: null,
    demoAvailable: false,
    hasWorkbook: true,
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

function renderPanel(props: {
  store: StoreAdapter;
  available?: boolean;
  lang?: "en" | "fr";
}) {
  const lang = props.lang ?? "en";
  const tree: ReactElement = (
    <LangContext.Provider value={{ lang, setLang: () => undefined }}>
      <StoreContext.Provider value={props.store}>
        <ExportPanel store={props.store} lang={lang} available={props.available ?? true} />
      </StoreContext.Provider>
    </LangContext.Provider>
  );
  return render(tree);
}

afterEach(cleanup);

describe("ExportPanel — the developer export (SUT-F-29)", () => {
  it("explains that the archive contains a clonable Git repository", () => {
    renderPanel({ store: store() });
    expect(screen.getByRole("heading", { name: "Export for developers" })).toBeTruthy();
    expect(screen.getByText(/clonable Git repository/)).toBeTruthy();
    expect(screen.getByText(/git clone/)).toBeTruthy();
    expect(screen.getByText(/git log -p/)).toBeTruthy();
  });

  it("says this is the only place where the format is named", () => {
    renderPanel({ store: store() });
    expect(screen.getByText(/only place in Suture that names the underlying format/)).toBeTruthy();
  });

});

describe("ExportPanel — behaviour", () => {
  it("produces the archive through the store", async () => {
    const exportBundle = vi.fn(async () => undefined);
    renderPanel({ store: store({ exportBundle }) });
    fireEvent.click(screen.getByRole("button", { name: "Produce the archive" }));
    expect(exportBundle).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Archive ready");
  });

  it("reports a failure without touching the tracked workbook", async () => {
    const exportBundle = vi.fn(async () => {
      throw new Error("boom");
    });
    renderPanel({ store: store({ exportBundle }) });
    fireEvent.click(screen.getByRole("button", { name: "Produce the archive" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The export failed");
  });

  it("is disabled and explains itself when no workbook is open", () => {
    renderPanel({ store: store(), available: false });
    const button = screen.getByRole("button", { name: "Produce the archive" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/available once a tracked workbook is open/)).toBeTruthy();
  });

});

describe("ExportPanel — languages", () => {
  it("is translated in French", () => {
    renderPanel({ store: store(), lang: "fr" });
    expect(screen.getByRole("heading", { name: "Export pour les développeurs" })).toBeTruthy();
    expect(screen.getByText(/dépôt Git clonable/)).toBeTruthy();
  });

  it("keeps the same keys in both languages", () => {
    expect(Object.keys(exportMessages.en).sort()).toEqual(
      Object.keys(exportMessages.fr).sort(),
    );
  });

  it("is reachable from screen 2", () => {
    const openStore = store({
      versions: [
        {
          id: "v1",
          note: "First draft",
          author: "Nadia",
          timestamp: Date.UTC(2026, 10, 2, 9, 0),
          scenario: "reference",
          parents: 1,
        },
      ],
      scenarios: [{ name: "reference", reference: true, head: "v1" }],
    });
    const tree: ReactElement = (
      <LangContext.Provider value={{ lang: "en", setLang: () => undefined }}>
        <StoreContext.Provider value={openStore}>
          <WorkbookScreen />
        </StoreContext.Provider>
      </LangContext.Provider>
    );
    render(tree);
    expect(screen.getByRole("heading", { name: "Export for developers" })).toBeTruthy();
    expect(translateExport("en", "title")).toBe("Export for developers");
  });
});
