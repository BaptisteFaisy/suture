import { useLang } from "../../i18n/lang";
import { translateScreen } from "./messages";

/**
 * Screen 4 — three-step combine assistant (spec merge-wizard).
 */
export function CombineScreen() {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  return (
    <section className="screen" aria-labelledby="combine-title">
      <h2 id="combine-title">{t("title")}</h2>
      <p className="empty-state">{t("placeholder")}</p>
    </section>
  );
}
