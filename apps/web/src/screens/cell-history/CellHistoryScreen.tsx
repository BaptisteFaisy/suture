import { useEffect, useState } from "react";
import { useLang } from "../../i18n/lang";
import { useNavigation } from "../../router";
import { useStore } from "../../store";
import { translateScreen } from "./messages";
import { buildHistoryRows, historyCount, isEmptyHistory } from "./cell-history-model";
import "./cell-history.css";

/**
 * Screen 5 — the history of one cell: every version where the entry
 * changed, with its author, its date, its version note and the values
 * before and after.
 */
export function CellHistoryScreen() {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  const store = useStore();
  const nav = useNavigation();
  const sheetId = nav.params.sheetId;
  const ref = nav.params.ref;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sheetId === undefined || ref === undefined) return;
    setLoading(true);
    setError(null);
    void store
      .showCellHistory(sheetId, ref)
      .catch((reason: unknown) => {
        const message = reason instanceof Error ? reason.message : String(reason);
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [sheetId, ref, store]);

  const entries = store.cellHistory;
  const rows = buildHistoryRows(entries ?? [], lang, t("unchanged"));

  return (
    <section className="screen cell-history" aria-labelledby="cell-history-title">
      <h2 id="cell-history-title">{t("title")}</h2>
      <p className="step-hint">{t("subtitle")}</p>
      {sheetId === undefined || ref === undefined ? (
        <p className="empty-state">{t("placeholder")}</p>
      ) : null}
      {loading ? <p className="empty-state">{t("loading")}</p> : null}
      {error !== null ? (
        <p className="error-note" role="alert">
          {t("error").replace("{reason}", error)}
        </p>
      ) : null}
      {!loading && error === null && sheetId !== undefined && ref !== undefined ? (
        <CellHistoryBody
          ref_={ref}
          count={historyCount(entries)}
          rows={rows}
          empty={isEmptyHistory(entries)}
        />
      ) : null}
    </section>
  );
}

/** The list of changes, or the empty state. */
function CellHistoryBody(props: {
  ref_: string;
  count: number;
  rows: ReturnType<typeof buildHistoryRows>;
  empty: boolean;
}) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  if (props.empty) {
    return <p className="empty-state">{t("empty")}</p>;
  }
  return (
    <>
      <p className="history-count" data-testid="history-count">
        {t("entry").replace("{count}", String(props.count))}
      </p>
      <ol className="history-list" aria-label={t("aria.list")} data-testid="history-list">
        {props.rows.map((row) => (
          <li
            key={row.versionId}
            className="history-entry"
            aria-label={t("aria.entry")
              .replace("{ref}", props.ref_)
              .replace("{date}", row.date)
              .replace("{author}", row.author)}
          >
            <p className="history-head">
              <strong className="cell-ref">{props.ref_}</strong>
              <span className="history-author">{row.author}</span>
              <span className="history-date">{row.date}</span>
            </p>
            <p className="history-note">{row.note}</p>
            <dl className="history-values">
              <div>
                <dt>{t("before")}</dt>
                <dd>{row.before}</dd>
              </div>
              <div>
                <dt>{t("after")}</dt>
                <dd>{row.after}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </>
  );
}
