import { useState } from "react";
import type { Lang } from "../../i18n/lang";
import type { ComparisonRow, ComparisonView } from "../../store";
import { buildSummary, type Translate } from "./logic";

export interface SummaryPanelProps {
  view: ComparisonView;
  /** Rows currently shown by the filters (drive the detail lines). */
  filteredRows: ComparisonRow[];
  lang: Lang;
  t: Translate;
}

/**
 * Deterministic summary of the comparison (SUT-F-13): the counts come from
 * the contract, the detail from the recalculated results. It is exposed as a
 * single readable block and can be copied as plain text.
 */
export function SummaryPanel(props: SummaryPanelProps) {
  const [copied, setCopied] = useState(false);
  const summary = buildSummary(props.view, props.filteredRows, props.lang, props.t);

  const copy = async () => {
    const clipboard = navigator.clipboard;
    if (clipboard === undefined) return;
    await clipboard.writeText(summary.plain);
    setCopied(true);
  };

  return (
    <section className="summary-panel" aria-labelledby="summary-title">
      <h3 id="summary-title">{props.t("summary.title")}</h3>
      <p className="summary-headline" role="status" aria-live="polite">
        {summary.headline}
      </p>
      {summary.details.length > 0 && (
        <>
          <h4 className="summary-detail-title">{props.t("summary.detail")}</h4>
          <ul className="summary-details">
            {summary.details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      )}
      <p className="summary-actions">
        <button type="button" className="summary-copy" onClick={() => void copy()}>
          {props.t("summary.copy")}
        </button>
        <span className="summary-copied" role="status">
          {copied ? props.t("summary.copied") : ""}
        </span>
      </p>
    </section>
  );
}
