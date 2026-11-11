import { useLang } from "../../i18n/lang";
import { translateScreen } from "./messages";
import type { AutomaticChange } from "./combine-model";

/**
 * Step 1 — what applies on its own.
 * A read-only list of the changes applied automatically, with a counter.
 */
export function StepOne(props: {
  changes: readonly AutomaticChange[];
  onContinue: () => void;
}) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  const groups = groupBySheet(props.changes);

  return (
    <section className="combine-step" aria-labelledby="combine-step1-title">
      <h3 id="combine-step1-title">{t("step1.title")}</h3>
      <p className="step-count" data-testid="automatic-count">
        {t("step1.count").replace("{count}", String(props.changes.length))}
      </p>
      {props.changes.length === 0 ? (
        <p className="empty-state">{t("step1.empty")}</p>
      ) : (
        groups.map((group) => <AutomaticGroup key={group.sheetName} sheetName={group.sheetName} rows={group.rows} />)
      )}
      <p className="step-hint">{t("step1.hint")}</p>
      <button type="button" className="demo-button" onClick={props.onContinue}>
        {t("step1.continue")}
      </button>
    </section>
  );
}

function groupBySheet(
  changes: readonly AutomaticChange[],
): { sheetName: string; rows: AutomaticChange[] }[] {
  const groups = new Map<string, AutomaticChange[]>();
  for (const change of changes) {
    const bucket = groups.get(change.sheetName);
    if (bucket) bucket.push(change);
    else groups.set(change.sheetName, [change]);
  }
  return [...groups.entries()].map(([sheetName, rows]) => ({ sheetName, rows }));
}

function AutomaticGroup(props: { sheetName: string; rows: AutomaticChange[] }) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  return (
    <div className="sheet-group">
      <h4 className="sheet-name">{props.sheetName}</h4>
      <table className="change-table">
        <caption className="visually-hidden">
          {t("step1.title")} — {props.sheetName}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t("report.cell")}</th>
            <th scope="col">{t("report.what")}</th>
            <th scope="col">{t("report.side")}</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={`${row.sheetName}-${row.ref}`}>
              <th scope="row">{row.ref}</th>
              <td>{row.value}</td>
              <td>{row.source === "A" ? t("disagreement.sideA") : t("disagreement.sideB")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
