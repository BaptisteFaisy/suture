import { useLang } from "../../i18n/lang";
import { translateCommon } from "../../i18n/common";
import { translateScreen } from "./messages";
import { groupReport, sideLabel, type ReportEntry } from "./combine-model";

/**
 * The report of the meeting, in four sections: applied, settled,
 * not carried over, to check.
 */
export function ReportTable(props: { entries: readonly ReportEntry[] }) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  const sections = groupReport(props.entries);
  const labels = {
    a: t("disagreement.sideA"),
    b: t("disagreement.sideB"),
    both: t("report.side"),
  };

  return (
    <div className="report" aria-label={t("aria.report")} data-testid="report">
      <ReportSection title={t("report.applied")} rows={sections.applied} labels={labels} />
      <ReportSection title={t("report.decided")} rows={sections.decided} labels={labels} />
      <ReportSection title={t("report.notCarried")} rows={sections.notCarried} labels={labels} />
      <ReportSection title={t("report.toReview")} rows={sections.toReview} labels={labels} />
    </div>
  );
}

function ReportSection(props: {
  title: string;
  rows: readonly ReportEntry[];
  labels: { a: string; b: string; both: string };
}) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  return (
    <section className="report-section">
      <h4>
        {props.title} <span className="report-count">{t("report.count").replace("{count}", String(props.rows.length))}</span>
      </h4>
      {props.rows.length === 0 ? (
        <p className="empty-state">{translateCommon(lang, "state.empty")}</p>
      ) : (
        <table className="change-table">
          <thead>
            <tr>
              <th scope="col">{t("report.sheet")}</th>
              <th scope="col">{t("report.cell")}</th>
              <th scope="col">{t("report.side")}</th>
              <th scope="col">{t("report.what")}</th>
              <th scope="col">{t("report.detail")}</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, index) => (
              <tr key={`${row.category}-${row.sheetName}-${row.ref ?? index}`}>
                <td>{row.sheetName}</td>
                <td>{row.ref ?? ""}</td>
                <td>{sideLabel(row.side, props.labels)}</td>
                <td>{row.label}</td>
                <td>{row.detail ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
