import { useLang } from "../../i18n/lang";
import { translateScreen } from "./messages";
import { DisagreementCard } from "./DisagreementCard";
import { FallbackNotice } from "./FallbackNotice";
import {
  openDisagreements,
  pendingFallbacks,
  type CombineChoice,
  type CombineState,
  type Fallback,
  type ReportEntry,
  type Side,
} from "./combine-model";

/**
 * Step 2 — the disagreements to settle.
 * The "Combine" action stays disabled while one disagreement is open.
 */
export function StepTwo(props: {
  state: CombineState;
  chosenFallbacks: Readonly<Record<string, Side>>;
  onChoose: (choice: CombineChoice) => void;
  onKeepSide: (sheetName: string, side: Side) => void;
  onCombine: () => void;
}) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  const open = openDisagreements(props.state);
  const pending = pendingFallbacks(props.state, props.chosenFallbacks);
  const blocked = open.length > 0 || pending.length > 0;

  return (
    <section className="combine-step" aria-labelledby="combine-step2-title">
      <h3 id="combine-step2-title">{t("step2.title")}</h3>
      <p className="step-count" role="status" aria-live="polite" data-testid="open-count">
        {open.length === 0
          ? t("step2.none")
          : t("step2.open").replace("{count}", String(open.length))}
      </p>
      {blocked ? (
        <p className="blocking-note" data-testid="blocked-note">
          {open.length > 0 ? t("step2.blocked") : t("fallback.pending")}
        </p>
      ) : null}
      <DisagreementList state={props.state} onChoose={props.onChoose} />
      <FallbackList
        state={props.state}
        chosenFallbacks={props.chosenFallbacks}
        onKeepSide={props.onKeepSide}
      />
      <button
        type="button"
        className="demo-button"
        disabled={blocked}
        onClick={props.onCombine}
        data-testid="combine-button"
      >
        {t("step2.combine")}
      </button>
    </section>
  );
}

/** Every disagreement of the plan, settled or not. */
function DisagreementList(props: {
  state: CombineState;
  onChoose: (choice: CombineChoice) => void;
}) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  if (props.state.disagreements.length === 0) {
    return <p className="empty-state">{t("step2.empty")}</p>;
  }
  return (
    <ul className="disagreement-list">
      {props.state.disagreements.map((item) => (
        <DisagreementCard
          key={item.id}
          item={item}
          choice={props.state.choices[item.id]}
          onChoose={props.onChoose}
        />
      ))}
    </ul>
  );
}

/** Every sheet refused to the automatic combine. */
function FallbackList(props: {
  state: CombineState;
  chosenFallbacks: Readonly<Record<string, Side>>;
  onKeepSide: (sheetName: string, side: Side) => void;
}) {
  if (props.state.fallbacks.length === 0) return null;
  return (
    <ul className="fallback-list">
      {props.state.fallbacks.map((fallback: Fallback) => (
        <FallbackNotice
          key={fallback.sheetName}
          fallback={fallback}
          kept={fallback.keptSide ?? props.chosenFallbacks[fallback.sheetName]}
          lostChanges={lostChangesFor(props.state.report, fallback.sheetName)}
          onKeep={(side: Side) => props.onKeepSide(fallback.sheetName, side)}
        />
      ))}
    </ul>
  );
}

/** Report lines of the side not kept, for one refused sheet. */
function lostChangesFor(
  report: readonly ReportEntry[],
  sheetName: string,
): ReportEntry[] {
  return report.filter(
    (entry) => entry.sheetName === sheetName && entry.category === "not-carried",
  );
}
