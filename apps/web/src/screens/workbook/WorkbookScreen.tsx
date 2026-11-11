import { useLang } from "../../i18n/lang";
import { translateScreen } from "./messages";

/**
 * Screen 2 — history graph, scenarios, milestones (lot B6).
 */
export function WorkbookScreen() {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  return (
    <section className="screen" aria-labelledby="workbook-title">
      <h2 id="workbook-title">{t("title")}</h2>
      <p className="empty-state">{t("placeholder")}</p>
    </section>
  );
}
