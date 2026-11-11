import { useState } from "react";
import { DemoBox, DropZone, Footer, Header } from "./components";
import { detectLang, translate, type Lang } from "./i18n";

/**
 * Screen 1 — Home: tracked workbooks, drop zone, demo workbook.
 * Engines land in the next lots; this shell wires the layout, i18n and
 * accessibility foundations (AA contrast, keyboard, reduced motion).
 */
export function App() {
  const [lang, setLang] = useState<Lang>(detectLang());
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);

  return (
    <div className="shell">
      <Header lang={lang} onLangChange={setLang} t={t} />
      <main>
        <p className="tagline">{t("app.tagline")}</p>
        <section aria-labelledby="workbooks-title">
          <h2 id="workbooks-title">{t("home.workbooks.title")}</h2>
          <p className="empty-state">{t("home.workbooks.empty")}</p>
        </section>
        <DropZone t={t} />
        <DemoBox t={t} />
      </main>
      <Footer t={t} />
    </div>
  );
}
