import { useLang } from "../../i18n/lang";
import { useStore } from "../../store";
import { HistoryGraph } from "./HistoryGraph";
import { ScenarioSection } from "./ScenarioList";
import { ScreenFeedback, VersionPanel } from "./VersionPanel";
import { WorkbookDialogs } from "./WorkbookDialogs";
import { ExportPanel } from "./export/ExportPanel";
import { translateScreen } from "./messages";
import type { ThreadVersion } from "./thread-layout";
import { useWorkbookScreen } from "./useWorkbookScreen";
import "./workbook.css";

/**
 * Screen 2 — the history thread of a tracked workbook, its versions, its
 * scenarios, its milestones, the restore and the developer export
 * (spec merge-wizard, journeys P4 / P8 / P9).
 */
export function WorkbookScreen() {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  const store = useStore();
  const actions = useWorkbookScreen(store, t("error.generic"));
  const versions: ThreadVersion[] = store.versions;

  if (versions.length === 0) return <EmptyWorkbook t={t} />;
  const selected =
    versions.find((version) => version.id === actions.state.selectedId) ?? null;

  return (
    <section className="screen" aria-labelledby="workbook-title">
      <h2 id="workbook-title">{t("title")}</h2>
      <p className="screen-subtitle">{t("subtitle")}</p>
      <ScreenFeedback status={actions.state.status} error={actions.state.error} />
      <HistoryGraph
        versions={versions}
        scenarios={store.scenarios}
        selectedId={actions.state.selectedId}
        lang={lang}
        t={t}
        onSelect={actions.select}
      />
      <div className="workbook-columns">
        <VersionPanel
          versions={versions}
          selected={selected}
          lang={lang}
          t={t}
          onSelect={actions.select}
          onMilestone={(id) => actions.askMilestone(findVersion(versions, id))}
          onRestore={(id) => actions.askRestore(findVersion(versions, id))}
        />
        <ScenarioSection
          store={store}
          versions={versions}
          selectedId={actions.state.selectedId}
          actions={actions}
          t={t}
        />
      </div>
      <ExportPanel store={store} lang={lang} available />
      <WorkbookDialogs actions={actions} store={store} t={t} />
    </section>
  );
}

function findVersion(
  versions: readonly ThreadVersion[],
  id: string,
): ThreadVersion | null {
  return versions.find((version) => version.id === id) ?? null;
}

function EmptyWorkbook(props: { t: (key: string) => string }) {
  return (
    <section className="screen" aria-labelledby="workbook-title">
      <h2 id="workbook-title">{props.t("title")}</h2>
      <p className="empty-state">{props.t("noWorkbook")}</p>
    </section>
  );
}
