import { useLang } from "../../i18n/lang";
import { translateScreen } from "./messages";

/**
 * Screen 5 — history of one cell, as a side panel.
 */
export function CellHistoryScreen() {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  return (
    <section className="screen" aria-labelledby="cell-history-title">
      <h2 id="cell-history-title">{t("title")}</h2>
      <p className="empty-state">{t("placeholder")}</p>
    </section>
  );
}
