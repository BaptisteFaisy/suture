import type { StoreAdapter } from "../../store";
import { canSetReference } from "./reference-capability";
import type { ThreadScenario, ThreadVersion } from "./thread-layout";
import type { WorkbookActions } from "./useWorkbookScreen";

export interface ScenarioListProps {
  readonly scenarios: readonly ThreadScenario[];
  readonly versions: readonly ThreadVersion[];
  readonly selectedId: string | null;
  /** True when the version store can move the Reference (optional capability). */
  readonly canChangeReference: boolean;
  readonly t: (key: string) => string;
  readonly onCreate: (name: string) => void;
  readonly onReference: (name: string) => void;
}

/**
 * Scenarios of screen 2 (SUT-F-16): create one from the selected version, see
 * which one is the Reference. Deleting a scenario is out of scope: a scenario
 * is part of the history and nothing is ever erased.
 */
export function ScenarioList(props: ScenarioListProps) {
  const { scenarios, t } = props;
  const selected = props.versions.find(
    (version) => version.id === props.selectedId,
  );
  return (
    <section className="scenario-panel" aria-labelledby="scenario-title">
      <h3 id="scenario-title">{t("scenarios.title")}</h3>
      <CreateScenario
        disabled={props.selectedId === null}
        origin={selected?.note ?? ""}
        t={t}
        onCreate={props.onCreate}
      />
      {scenarios.length === 0 ? (
        <p className="empty-state">{t("scenarios.empty")}</p>
      ) : (
        <ScenarioRows
          scenarios={scenarios}
          canChangeReference={props.canChangeReference}
          t={t}
          onReference={props.onReference}
        />
      )}
    </section>
  );
}

function ScenarioRows(props: {
  scenarios: readonly ThreadScenario[];
  canChangeReference: boolean;
  t: (key: string) => string;
  onReference: (name: string) => void;
}) {
  const { scenarios, canChangeReference, t } = props;
  return (
    <ul className="scenario-list">
      {scenarios.map((scenario) => (
        <li key={scenario.name} className="scenario-row">
          <span className="scenario-name">{scenario.name}</span>
          {scenario.reference && (
            <span className="scenario-reference">{t("scenarios.reference")}</span>
          )}
          {!scenario.reference && canChangeReference && (
            <button type="button" onClick={() => props.onReference(scenario.name)}>
              {t("scenarios.makeReference")}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function CreateScenario(props: {
  disabled: boolean;
  origin: string;
  t: (key: string) => string;
  onCreate: (name: string) => void;
}) {
  const { disabled, t } = props;
  return (
    <form
      className="scenario-create"
      onSubmit={(event) => {
        event.preventDefault();
        const input = event.currentTarget.elements.namedItem("scenario-name");
        if (!(input instanceof HTMLInputElement)) return;
        const name = input.value.trim();
        if (name !== "") {
          props.onCreate(name);
          input.value = "";
        }
      }}
    >
      <label className="scenario-create-label" htmlFor="scenario-name">
        {t("scenarios.create")}
      </label>
      <input
        id="scenario-name"
        name="scenario-name"
        type="text"
        required
        disabled={disabled}
        aria-describedby="scenario-origin"
      />
      <span className="scenario-origin" id="scenario-origin">
        {disabled
          ? t("scenarios.pickVersionFirst")
          : `${t("scenarios.fromVersion")} ${props.origin}`}
      </span>
      <button type="submit" disabled={disabled}>
        {t("scenarios.submit")}
      </button>
    </form>
  );
}

/** Screen 2 section: the scenarios plus the store calls they trigger. */
export function ScenarioSection(props: {
  readonly store: StoreAdapter;
  readonly versions: readonly ThreadVersion[];
  readonly selectedId: string | null;
  readonly actions: WorkbookActions;
  readonly t: (key: string) => string;
}) {
  const { store, actions, t } = props;
  return (
    <ScenarioList
      scenarios={store.scenarios}
      versions={props.versions}
      selectedId={props.selectedId}
      canChangeReference={canSetReference(store)}
      t={t}
      onCreate={(name) =>
        void actions.run(() => store.createScenario(name), t("status.scenarioCreated"))
      }
      onReference={(name) => {
        if (!canSetReference(store)) {
          actions.fail(t("scenarios.referenceUnavailable"));
          return;
        }
        void actions.run(
          () => store.setReferenceScenario(name),
          t("status.referenceSet"),
        );
      }}
    />
  );
}
