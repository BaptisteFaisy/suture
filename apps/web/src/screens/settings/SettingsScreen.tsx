import { useLang } from "../../i18n/lang";
import { translateScreen } from "./messages";

/**
 * Screen 6 — author name, language, storage, export.
 */
export function SettingsScreen() {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  return (
    <section className="screen" aria-labelledby="settings-title">
      <h2 id="settings-title">{t("title")}</h2>
      <p className="empty-state">{t("placeholder")}</p>
    </section>
  );
}
