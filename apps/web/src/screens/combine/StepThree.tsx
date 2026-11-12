import { useLang } from "../../i18n/lang";
import { translateScreen } from "./messages";
import { ReportTable } from "./ReportTable";
import { reportToText, type ReportEntry } from "./combine-model";

/**
 * Step 3 — the report and the download.
 * The report is offered as a text file, and the combined workbook is the
 * file the meeting produced.
 */
export function StepThree(props: {
  entries: readonly ReportEntry[];
  workbookReady: boolean;
  onDownloadWorkbook: () => void;
  onBack: () => void;
}) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  return (
    <section className="combine-step" aria-labelledby="combine-step3-title">
      <h3 id="combine-step3-title">{t("step3.title")}</h3>
      {props.entries.length === 0 ? (
        <p className="empty-state">{t("step3.empty")}</p>
      ) : (
        <ReportTable entries={props.entries} />
      )}
      <StepThreeActions
        hasEntries={props.entries.length > 0}
        workbookReady={props.workbookReady}
        onDownloadReport={() => downloadReport(props.entries, t)}
        onDownloadWorkbook={props.onDownloadWorkbook}
        onBack={props.onBack}
      />
    </section>
  );
}

/** The two downloads of the last step. */
function StepThreeActions(props: {
  hasEntries: boolean;
  workbookReady: boolean;
  onDownloadReport: () => void;
  onDownloadWorkbook: () => void;
  onBack: () => void;
}) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  return (
    <div className="step-actions">
      <button
        type="button"
        className="demo-button"
        onClick={props.onDownloadReport}
        disabled={!props.hasEntries}
      >
        {t("step3.download.report")}
      </button>
      <button
        type="button"
        className="demo-button"
        onClick={props.onDownloadWorkbook}
        disabled={!props.workbookReady}
      >
        {t("step3.download.workbook")}
      </button>
      {!props.workbookReady ? (
        <p className="field-hint">{t("step3.workbook.unavailable")}</p>
      ) : null}
      <button type="button" className="link-button" onClick={props.onBack}>
        {t("step3.back")}
      </button>
    </div>
  );
}

/** Builds the text of the report and offers it as a download. */
function downloadReport(
  entries: readonly ReportEntry[],
  t: (key: string) => string,
): void {
  const titles = {
    applied: t("report.applied"),
    decided: t("report.decided"),
    notCarried: t("report.notCarried"),
    toReview: t("report.toReview"),
  };
  const labels = {
    a: t("disagreement.sideA"),
    b: t("disagreement.sideB"),
    both: t("report.side"),
  };
  const text = reportToText(entries, titles, labels);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "suture-report.txt";
  link.click();
  URL.revokeObjectURL(url);
}
