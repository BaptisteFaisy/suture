import { useLang } from "../../i18n/lang";
import { translateScreen } from "./messages";

/**
 * Screen 3 — change grid, summary, filters (spec compare-ui).
 */
export function CompareScreen() {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  return (
    <section className="screen" aria-labelledby="compare-title">
      <h2 id="compare-title">{t("title")}</h2>
      <p className="empty-state">{t("placeholder")}</p>
    </section>
  );
}
