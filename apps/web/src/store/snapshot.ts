/**
 * Builds the `StoreAdapter` object the screens consume, from the core state.
 * Each group of actions is a small function so nothing grows past the
 * workspace limits, and the whole object is rebuilt on every state change
 * (which is what makes `useSyncExternalStore` see the update).
 */
import type { DisagreementChoice } from "@suture/contracts";
import type { StoreAdapter } from "./index";
import type { Core } from "./core";
import { guarded } from "./core";
import {
  choose,
  compareVersions,
  comparisonView,
  combineView,
  combineSidesOf,
  loadDemo,
  openWorkbook,
  planCombine,
  refresh,
  trackFile,
  versionSummaries,
} from "./actions";
import {
  downloadVersion,
  exportWorkbook,
  finalizeCombine,
  restoreVersion,
} from "./finalize";

type Translate = (key: string) => string;

/** The read-only part of the contract. */
function stateOf(core: Core): Partial<StoreAdapter> {
  const state = core.state;
  return {
    workbooks: state.workbooks,
    status: state.status,
    error: state.error,
    demoAvailable: state.demoAvailable,
    hasWorkbook: state.session.workbookId !== null,
    versions: versionSummaries(state),
    scenarios: state.session.scenarios,
    comparison: state.comparison,
    combine: state.combine,
    cellHistory: state.cellHistory,
    authorName: state.authorName,
  };
}

/** Home screen actions: open, track a dropped file, load the demo. */
function homeActions(core: Core, translate: Translate) {
  return {
    openWorkbook: (id: string) => {
      void guarded(
        core,
        async () => {
          const session = await openWorkbook(core.deps, id);
          core.set({ session, comparison: null, combine: null, cellHistory: null });
        },
        translate,
      );
    },
    trackFile: async (file: File) => {
      await guarded(
        core,
        async () => {
          const session = await trackFile(core.deps, core.registry, core.state.session, file);
          core.set({
            session,
            workbooks: summaries(core),
            comparison: null,
            combine: null,
          });
        },
        translate,
      );
    },
    loadDemo: async () => {
      await guarded(
        core,
        async () => {
          const session = await loadDemo(core.deps, core.registry);
          core.set({ session, workbooks: summaries(core), demoAvailable: true });
        },
        translate,
      );
      if (core.state.status === "error") core.set({ demoAvailable: false });
    },
  };
}

function summaries(core: Core) {
  return core.registry.list().map((record) => {
    const active = core.state.session.workbookId === record.id;
    return {
      id: record.id,
      name: record.name,
      versions: active ? core.state.session.versions.length : 0,
      scenarios: active ? core.state.session.scenarios.map((item) => item.name) : [],
      updatedAt: record.createdAt,
    };
  });
}

/** Workbook screen actions: scenarios, milestones, restore, export. */
function workbookActions(core: Core, translate: Translate) {
  const store = () => core.state.session.store;
  return {
    createScenario: async (name: string) => {
      await guarded(
        core,
        async () => {
          const current = store();
          const head = core.state.session.versions[0]?.id;
          if (current === null || head === undefined) return;
          await current.createScenario(name, head);
          core.set({ session: await refresh(core.state.session) });
        },
        translate,
      );
    },
    setMilestone: async (versionId: string, name: string) => {
      await guarded(
        core,
        async () => {
          await store()?.setMilestone(versionId, name);
          core.set({ session: await refresh(core.state.session) });
        },
        translate,
      );
    },
    restoreVersion: async (versionId: string) => {
      await guarded(
        core,
        async () => {
          const session = await restoreVersion(core.state.session, core.registry, versionId);
          core.set({ session });
        },
        translate,
      );
    },
    exportBundle: async () => {
      await guarded(
        core,
        async () => {
          const name = core.registry.find(core.state.session.workbookId ?? "")?.name ?? "workbook";
          await exportWorkbook(core.deps, core.state.session, name);
        },
        translate,
      );
    },
  };
}

/** Téléchargement d'une version passée (SUT-F-05). */
function downloadActions(core: Core, translate: Translate) {
  return {
    downloadVersion: async (versionId: string) => {
      await guarded(core, () => downloadVersion(core.deps, core.state.session, versionId), translate);
    },
  };
}

/** Compare screen actions. */
function compareActions(core: Core, translate: Translate) {
  return {
    compare: async (fromVersion: string, toVersion: string) => {
      await guarded(
        core,
        async () => {
          const session = await compareVersions(
            core.deps,
            core.state.session,
            fromVersion,
            toVersion,
          );
          core.set({ session, comparison: comparisonView(session) });
        },
        translate,
      );
    },
    setComparisonFilter: (filter: Partial<StoreAdapter["comparison"] extends null ? never : object>) => {
      const session = {
        ...core.state.session,
        filter: { ...core.state.session.filter, ...filter },
      };
      core.set({ session, comparison: comparisonView(session) });
    },
  };
}

/** Combine screen actions. */
function combineActions(core: Core, translate: Translate) {
  return {
    startCombine: async (sideA: string, sideB: string) => {
      await guarded(
        core,
        async () => {
          const session = await planCombine(core.deps, core.state.session, sideA, sideB);
          core.set({ session, combine: combineView(session) });
        },
        translate,
      );
    },
    chooseDisagreement: (id: string, choice: DisagreementChoice) => {
      const session = choose(core.state.session, id, choice);
      core.set({ session, combine: combineView(session) });
    },
    finalizeCombine: async () => {
      await guarded(
        core,
        async () => {
          const session = await finalizeCombine(core.deps, core.registry, core.state.session);
          core.set({
            session,
            combine: combineView(session),
            workbooks: summaries(core),
          });
        },
        translate,
      );
    },
    combineSides: () => combineSidesOf(core.state.session),
  };
}

/** Settings and cell history. */
function settingsActions(core: Core, translate: Translate) {
  return {
    showCellHistory: async (sheetId: number, ref: string) => {
      await guarded(
        core,
        async () => {
          const history = await core.state.session.store?.cellHistory(sheetId, ref);
          core.set({ cellHistory: history ?? null });
        },
        translate,
      );
    },
    setAuthorName: (name: string) => {
      core.registry.setAuthor(name);
      core.set({ authorName: name });
    },
    exportEverything: async () => {
      await guarded(
        core,
        async () => {
          for (const record of core.registry.list()) {
            const session = await openWorkbook(core.deps, record.id);
            await exportWorkbook(core.deps, session, record.name);
          }
        },
        translate,
      );
    },
    clearStorage: async () => {
      core.registry.clear();
      core.set({
        workbooks: [],
        session: { ...core.state.session, workbookId: null, store: null, versions: [] },
        comparison: null,
        combine: null,
        cellHistory: null,
      });
    },
  };
}

/** The full contract, rebuilt on every state change. */
export function buildSnapshot(core: Core, translate: Translate): StoreAdapter {
  return {
    ...stateOf(core),
    ...homeActions(core, translate),
    ...workbookActions(core, translate),
    ...downloadActions(core, translate),
    ...compareActions(core, translate),
    ...combineActions(core, translate),
    ...settingsActions(core, translate),
  } as StoreAdapter;
}
