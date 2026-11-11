import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useLang, type Lang } from "../../i18n/lang";
import {
  useStore,
  type ComparisonFilter,
  type ComparisonRow,
  type ComparisonView,
  type StoreAdapter,
  type VersionSummary,
} from "../../store";
import { ComparisonGrid, type ComparisonGridHandle } from "./ComparisonGrid";
import { FilterBar } from "./FilterBar";
import { OtherPartsList } from "./OtherPartsList";
import { SummaryPanel } from "./SummaryPanel";
import { applyComparisonFilter, isIdentical, sheetIdsOf, type Translate } from "./logic";
import { translateScreen } from "./messages";
import "./compare.css";

const NO_FILTER: ComparisonFilter = { sheetId: "all", nature: "all" };

/**
 * Screen 3 — the grid of differences on the left, the summary and the filters
 * on the right (B.12). Everything comes from the store contract: the screen
 * never talks to an engine.
 */
export function CompareScreen() {
  const { lang } = useLang();
  const t: Translate = (key) => translateScreen(lang, key);
  const store = useStore();
  const gridRef = useRef<ComparisonGridHandle>(null);
  const view = store.comparison;
  const filter = view?.filter ?? NO_FILTER;

  const rows = useMemo(
    () => (view === null ? [] : applyComparisonFilter(view.rows, filter)),
    [view, filter],
  );
  const sheetIds = useMemo(() => (view === null ? [] : sheetIdsOf(view.rows)), [view]);

  return (
    <section className="screen compare-screen" aria-labelledby="compare-title">
      <h2 id="compare-title">{t("title")}</h2>
      <p className="compare-intro">{t("intro")}</p>
      <VersionPickers store={store} t={t} />
      {stateMessage(store, view, t) ?? (
        <CompareLayout
          store={store}
          view={view as ComparisonView}
          rows={rows}
          sheetIds={sheetIds}
          filter={filter}
          lang={lang}
          t={t}
          gridRef={gridRef}
        />
      )}
    </section>
  );
}

/** Error, wait or "identical" message; null when a comparison is to be shown. */
function stateMessage(
  store: StoreAdapter,
  view: ComparisonView | null,
  t: Translate,
): ReactNode {
  if (store.status === "error" && store.error !== null) {
    return (
      <div className="compare-state" role="alert">
        <p>{t("state.error")}</p>
        <p className="compare-error-detail">{store.error}</p>
      </div>
    );
  }
  if (view === null) {
    return (
      <p className="compare-state" role="status">
        {store.status === "loading" ? t("state.loading") : t("state.waiting")}
      </p>
    );
  }
  if (isIdentical(view)) {
    return (
      <p className="compare-state" role="status">
        {t("state.identical")}
      </p>
    );
  }
  return null;
}

interface CompareLayoutProps {
  store: StoreAdapter;
  view: ComparisonView;
  rows: ComparisonRow[];
  sheetIds: number[];
  filter: ComparisonFilter;
  lang: Lang;
  t: Translate;
  gridRef: RefObject<ComparisonGridHandle | null>;
}

/** The working screen: grid on the left, summary and filters on the right. */
function CompareLayout(props: CompareLayoutProps) {
  const { store, view, t } = props;
  return (
    <div className="compare-layout">
      <div className="compare-main">
        <div className="compare-toolbar">
          <h3>{t("grid.title")}</h3>
          <button
            type="button"
            className="compare-next"
            onClick={() => props.gridRef.current?.nextDifference()}
          >
            {t("next.title")}
          </button>
        </div>
        <p className="compare-hint">{t("next.hint")}</p>
        {props.rows.length === 0 ? (
          <p className="compare-state">{t("grid.empty")}</p>
        ) : (
          <ComparisonGrid rows={props.rows} t={t} lang={props.lang} gridRef={props.gridRef} />
        )}
      </div>
      <div className="compare-side">
        <SummaryPanel view={view} filteredRows={props.rows} lang={props.lang} t={t} />
        <FilterBar
          filter={props.filter}
          sheetIds={props.sheetIds}
          shown={props.rows.length}
          lang={props.lang}
          t={t}
          onChange={(patch) => store.setComparisonFilter(patch)}
        />
        <OtherPartsList otherParts={view.otherParts} t={t} />
      </div>
    </div>
  );
}

/** The two version selectors that start a comparison. */
function VersionPickers(props: { store: StoreAdapter; t: Translate }) {
  const versions = props.store.versions;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (versions.length >= 2 && from === "" && to === "") {
      setFrom(versions[0]?.id ?? "");
      setTo(versions[1]?.id ?? "");
    }
  }, [versions, from, to]);

  if (versions.length < 2) return null;
  return (
    <div className="compare-versions">
      <VersionSelect
        label={props.t("versions.from")}
        placeholder={props.t("versions.choose")}
        versions={versions}
        value={from}
        onPick={setFrom}
      />
      <VersionSelect
        label={props.t("versions.to")}
        placeholder={props.t("versions.choose")}
        versions={versions}
        value={to}
        onPick={setTo}
      />
      <button
        type="button"
        onClick={() => {
          if (from !== "" && to !== "") void props.store.compare(from, to);
        }}
      >
        {props.t("action.compare")}
      </button>
    </div>
  );
}

interface VersionSelectProps {
  label: string;
  placeholder: string;
  versions: VersionSummary[];
  value: string;
  onPick: (id: string) => void;
}

/** One labelled list of versions, newest first as the store gives them. */
function VersionSelect(props: VersionSelectProps) {
  return (
    <label>
      <span>{props.label}</span>
      <select value={props.value} onChange={(event) => props.onPick(event.target.value)}>
        <option value="">{props.placeholder}</option>
        {props.versions.map((version) => (
          <option key={version.id} value={version.id}>
            {version.note}
          </option>
        ))}
      </select>
    </label>
  );
}
