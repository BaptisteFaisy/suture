import { useState } from "react";
import type { StoreAdapter } from "../../../store";
import type { Lang } from "../../../i18n/lang";
import { translateExport } from "./messages";

/**
 * Developer-facing export panel (SUT-F-29). The archive contains a clonable
 * Git repository: this is the only screen of Suture allowed to say so, because
 * the feature exists precisely for the developer counter-persona.
 */
export function ExportPanel(props: {
  readonly store: StoreAdapter;
  readonly lang: Lang;
  readonly available: boolean;
}) {
  const t = (key: string) => translateExport(props.lang, key);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(false);
    setDone(false);
    try {
      await props.store.exportBundle();
      setDone(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="export-panel" aria-labelledby="export-title">
      <h3 id="export-title">{t("title")}</h3>
      <p className="export-intro">{t("intro")}</p>
      <button
        type="button"
        className="export-action"
        disabled={!props.available || busy}
        onClick={() => void run()}
      >
        {busy ? t("working") : t("action")}
      </button>
      {!props.available && <p className="export-hint">{t("unavailable")}</p>}
      <ExportState busy={busy} done={done} error={error} t={t} />
      <ExportSteps t={t} />
    </section>
  );
}

/** The outcome of the last export attempt, announced to assistive technology. */
function ExportState(props: {
  busy: boolean;
  done: boolean;
  error: boolean;
  t: (key: string) => string;
}) {
  const { busy, done, error, t } = props;
  if (busy) {
    return (
      <p className="export-status" role="status">
        {t("working")}
      </p>
    );
  }
  if (done) {
    return (
      <p className="export-status" role="status">
        {t("done")}
      </p>
    );
  }
  if (error) {
    return (
      <p className="export-error" role="alert">
        {t("error")}
      </p>
    );
  }
  return null;
}

/** The three commands a developer runs on the exported archive. */
function ExportSteps(props: { t: (key: string) => string }) {
  const { t } = props;
  return (
    <details className="export-steps">
      <summary>{t("steps.title")}</summary>
      <ol>
        <li>{t("steps.unzip")}</li>
        <li>
          <code>{t("steps.clone")}</code>
        </li>
        <li>
          <code>{t("steps.log")}</code>
        </li>
      </ol>
      <p className="export-note">{t("onlyPlace")}</p>
    </details>
  );
}
