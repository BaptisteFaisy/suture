import { translateCommon } from "./i18n/common";
import { useLang } from "./i18n/lang";
import { useNavigation } from "./router";

/** Shared chrome: brand, language picker, navigation, footer. */
export function Header() {
  const { lang, setLang } = useLang();
  const nav = useNavigation();
  const t = (key: string) => translateCommon(lang, key);
  return (
    <header className="topbar">
      <div className="brand">
        <button type="button" className="brand-button" onClick={() => nav.go("home")}>
          <span className="stitch-mark" aria-hidden="true" />
          <span className="brand-name">{t("app.name")}</span>
        </button>
      </div>
      <nav className="mainnav" aria-label={t("nav.home")}>
        <button type="button" onClick={() => nav.go("home")}>
          {t("nav.home")}
        </button>
        <button type="button" onClick={() => nav.go("settings")}>
          {t("nav.settings")}
        </button>
      </nav>
      <label className="lang-picker">
        <span className="visually-hidden">{t("nav.settings")}</span>
        <select
          value={lang}
          onChange={(event) => setLang(event.target.value === "fr" ? "fr" : "en")}
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
        </select>
      </label>
    </header>
  );
}

export function Footer() {
  const { lang } = useLang();
  return <footer>{translateCommon(lang, "footer.built")}</footer>;
}
