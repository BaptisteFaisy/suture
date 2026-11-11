import type { Lang } from "../../i18n/lang";

/**
 * Language of screen 6. The shell already offers the same choice in its top
 * bar; this panel only exposes it again, it never keeps a second state.
 */
export function LanguagePanel(props: {
  readonly lang: Lang;
  readonly setLang: (lang: Lang) => void;
  readonly t: (key: string) => string;
}) {
  const { lang, setLang, t } = props;
  return (
    <section className="settings-panel" aria-labelledby="language-title">
      <h3 id="language-title">{t("language.title")}</h3>
      <label htmlFor="language-select">{t("language.label")}</label>
      <select
        id="language-select"
        value={lang}
        onChange={(event) => setLang(event.target.value === "fr" ? "fr" : "en")}
      >
        <option value="en">{t("language.en")}</option>
        <option value="fr">{t("language.fr")}</option>
      </select>
      <p className="settings-hint">{t("language.note")}</p>
    </section>
  );
}
