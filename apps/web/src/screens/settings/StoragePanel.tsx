import type { StoreAdapter } from "../../store";
import type { Lang } from "../../i18n/lang";
import { Dialog } from "../workbook/Dialog";
import { formatBytes, formatPercent, interpolate } from "../workbook/format";
import { useStorage, type StorageState } from "./useStorage";
import type { StorageQuota } from "./storage-quota";

/**
 * Storage panel of screen 6 (SUT-N-05): persistence request, quota, the export
 * reminder before 30 % of the space is used, the full export and the erasure.
 */
export function StoragePanel(props: {
  readonly store: StoreAdapter;
  readonly lang: Lang;
  readonly t: (key: string) => string;
}) {
  const { store, lang, t } = props;
  const storage = useStorage(store);

  return (
    <section className="settings-panel" aria-labelledby="storage-title">
      <h3 id="storage-title">{t("storage.title")}</h3>
      <p className="settings-hint">{t("storage.intro")}</p>
      <QuotaLine quota={storage.quota} lang={lang} t={t} />
      <StorageFeedback state={storage} />
      {storage.remind && (
        <p className="settings-reminder" role="status">
          {t("storage.reminder")}
        </p>
      )}
      <div className="settings-actions">
        <button type="button" onClick={() => void storage.askPersistence(t)}>
          {t("storage.persist")}
        </button>
        <button
          type="button"
          className="danger"
          disabled={storage.busy !== null}
          onClick={storage.openClear}
        >
          {t("storage.clear")}
        </button>
      </div>
      <ExportAllGroup storage={storage} t={t} />
      <Dialog
        open={storage.confirmClear}
        title={t("storage.clearTitle")}
        hint={t("storage.clearHint")}
        t={t}
        onDismiss={storage.closeClear}
        confirmLabel={t("storage.clearConfirm")}
        onConfirm={() => void storage.clearEverything(t)}
      />
    </section>
  );
}

/** The full export: one archive with every tracked workbook. */
function ExportAllGroup(props: {
  storage: ReturnType<typeof useStorage>;
  t: (key: string) => string;
}) {
  const { storage, t } = props;
  return (
    <div className="settings-export">
      <h4 id="export-all-title">{t("export.title")}</h4>
      <p className="settings-hint">{t("export.intro")}</p>
      <button
        type="button"
        disabled={storage.busy !== null}
        onClick={() => void storage.exportEverything(t)}
      >
        {storage.busy === "export" ? t("export.working") : t("export.action")}
      </button>
    </div>
  );
}

function StorageFeedback(props: { state: StorageState }) {
  const { notice, error } = props.state;
  return (
    <>
      {notice !== null && (
        <p className="settings-notice" role="status">
          {notice}
        </p>
      )}
      {error !== null && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function QuotaLine(props: {
  quota: StorageQuota | null;
  lang: Lang;
  t: (key: string) => string;
}) {
  const { quota, lang, t } = props;
  if (quota === null) {
    return <p className="settings-quota">{t("storage.unavailable")}</p>;
  }
  const ratio = quota.quota > 0 ? quota.usage / quota.quota : 0;
  return (
    <p className="settings-quota">
      {interpolate(t("storage.usage"), {
        usage: formatBytes(quota.usage, lang),
        quota: formatBytes(quota.quota, lang),
        percent: formatPercent(ratio, lang),
      })}
      {quota.persisted ? "" : ` — ${t("storage.persistUnsupported")}`}
    </p>
  );
}
