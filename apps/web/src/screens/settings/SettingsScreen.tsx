import { useState } from "react";
import { useLang } from "../../i18n/lang";
import { useStore } from "../../store";
import { AuthorPanel } from "./AuthorPanel";
import { LanguagePanel } from "./LanguagePanel";
import { StoragePanel } from "./StoragePanel";
import { translateScreen } from "./messages";
import "./settings.css";
import "../workbook/workbook.css";

/**
 * Screen 6 — author name, language, storage, export. The language picker of the
 * shell is not duplicated: this screen only offers the same choice.
 */
export function SettingsScreen() {
  const { lang, setLang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  const store = useStore();
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  return (
    <section className="screen" aria-labelledby="settings-title">
      <h2 id="settings-title">{t("title")}</h2>
      <p className="screen-subtitle">{t("subtitle")}</p>
      <p className="live-region" role="status" aria-live="polite">
        {notice ?? ""}
      </p>
      {warning !== null && (
        <p className="settings-error" role="alert">
          {warning}
        </p>
      )}
      <AuthorPanel
        store={store}
        t={t}
        onSaved={() => {
          setWarning(null);
          setNotice(t("author.saved"));
        }}
        onRefused={() => {
          setNotice(null);
          setWarning(t("author.missing"));
        }}
      />
      <LanguagePanel lang={lang} setLang={setLang} t={t} />
      <StoragePanel store={store} lang={lang} t={t} />
    </section>
  );
}
