// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { LangContext } from "../../i18n/lang";
import { StoreContext, type StoreAdapter, type VersionSummary } from "../../store";
import { WorkbookScreen } from "./WorkbookScreen";

/** The demo case: an original, one divergent scenario, one combine. */
function demoVersions(): VersionSummary[] {
  return [
    {
      id: "v1",
      note: "First draft",
      author: "Nadia",
      timestamp: Date.UTC(2026, 10, 2, 9, 0),
      scenario: "reference",
      parents: 1,
    },
    {
      id: "v2",
      note: "Paul's copy",
      author: "Paul",
      timestamp: Date.UTC(2026, 10, 5, 10, 0),
      scenario: "paul",
      parents: 1,
    },
    {
      id: "v3",
      note: "Combined with Paul",
      author: "Nadia",
      timestamp: Date.UTC(2026, 10, 9, 14, 0),
      scenario: "reference",
      parents: 2,
      milestone: "Budget adopted",
    },
  ];
}

function emptyStore(): StoreAdapter {
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
  };
}

function fakeStore(overrides: Partial<StoreAdapter> = {}): StoreAdapter {
  return {
    ...emptyStore(),
    hasWorkbook: true,
    versions: demoVersions(),
    scenarios: [
      { name: "reference", reference: true, head: "v3" },
      { name: "paul", reference: false, head: "v2" },
    ],
    ...overrides,
  };
}

function renderScreen(store: StoreAdapter, lang: "en" | "fr" = "en") {
  const tree: ReactElement = (
    <LangContext.Provider value={{ lang, setLang: () => undefined }}>
      <StoreContext.Provider value={store}>
        <WorkbookScreen />
      </StoreContext.Provider>
    </LangContext.Provider>
  );
  return render(tree);
}

afterEach(cleanup);

describe("WorkbookScreen — the history thread", () => {
  it("draws one point per version", () => {
    renderScreen(fakeStore());
    const points = screen.getAllByRole("button", { name: /^version \d/ });
    expect(points).toHaveLength(3);
  });

  it("labels every point with its rank, its author and its date", () => {
    renderScreen(fakeStore());
    expect(
      screen.getByRole("button", { name: /version 2, Paul, 5 November 2026/ }),
    ).toBeTruthy();
  });

  it("selects the version when its point is clicked", () => {
    renderScreen(fakeStore());
    const point = screen.getByRole("button", { name: /version 2, Paul/ });
    expect(point.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(point);
    expect(
      screen.getByRole("button", { name: /version 2, Paul/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getAllByText("Paul's copy").length).toBeGreaterThan(0);
  });

  it("explains an empty tracked workbook instead of drawing nothing", () => {
    renderScreen(emptyStore());
    expect(screen.queryByRole("button", { name: /^version \d/ })).toBeNull();
    expect(screen.getByText(/Open a tracked workbook/)).toBeTruthy();
  });
});

describe("WorkbookScreen — restore (SUT-F-27)", () => {
  it("asks for a confirmation and explains that nothing is erased", () => {
    const restoreVersion = vi.fn(async () => undefined);
    renderScreen(fakeStore({ restoreVersion }));
    fireEvent.click(screen.getAllByRole("button", { name: "Restore" })[0]!);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Restore this version/)).toBeTruthy();
    expect(within(dialog).getByText(/No version is erased/)).toBeTruthy();
    expect(restoreVersion).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Restore" }));
    expect(restoreVersion).toHaveBeenCalledWith("v3");
  });

  it("closes the confirmation without restoring on cancel", () => {
    const restoreVersion = vi.fn(async () => undefined);
    renderScreen(fakeStore({ restoreVersion }));
    fireEvent.click(screen.getAllByRole("button", { name: "Restore" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(restoreVersion).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("WorkbookScreen — milestones (SUT-F-28)", () => {
  it("names a version from the milestone dialog", () => {
    const setMilestone = vi.fn(async () => undefined);
    renderScreen(fakeStore({ setMilestone }));
    fireEvent.click(screen.getAllByRole("button", { name: "Set a milestone" })[0]!);

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Milestone name"), {
      target: { value: "Budget adopted on 12 November" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Set the milestone" }));
    expect(setMilestone).toHaveBeenCalledWith("v3", "Budget adopted on 12 November");
  });
});

describe("WorkbookScreen — scenarios (SUT-F-16)", () => {
  it("creates a scenario once a version is selected", () => {
    const createScenario = vi.fn(async () => undefined);
    renderScreen(fakeStore({ createScenario }));
    const input = screen.getByLabelText("New scenario") as HTMLInputElement;
    expect(input.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /version 2, Paul/ }));
    expect((screen.getByLabelText("New scenario") as HTMLInputElement).disabled).toBe(
      false,
    );

    fireEvent.change(screen.getByLabelText("New scenario"), {
      target: { value: "Hiring +2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(createScenario).toHaveBeenCalledWith("Hiring +2");
  });

  it("shows which scenario is the Reference", () => {
    renderScreen(fakeStore());
    expect(screen.getByText("Reference")).toBeTruthy();
  });

  it("offers to move the Reference only when the version store can do it", () => {
    const setReferenceScenario = vi.fn(async () => undefined);
    const capable = {
      ...fakeStore(),
      setReferenceScenario,
    } as unknown as StoreAdapter;
    renderScreen(capable);
    expect(screen.queryByText(/not offered by the version store/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Make this the reference" }));
    expect(setReferenceScenario).toHaveBeenCalledWith("paul");
  });
});

describe("WorkbookScreen — vocabulary (SUT-N-09)", () => {
  const BANNED =
    /\b(git|commit|branch|merge|diff|conflict|repo|repository|tag|revert|blame|clone|push|pull|checkout|stash|master|fork|upstream|remote|dépôt|branche|fusion|conflit|étiquette)\b/i;

  it.each(["en", "fr"] as const)("never names a developer word outside the export panel", (lang) => {
    const { container } = renderScreen(fakeStore(), lang);
    const panel = container.querySelector(".export-panel");
    const text = (container.textContent ?? "").replace(panel?.textContent ?? "", "");
    expect(BANNED.test(text)).toBe(false);
  });
});
