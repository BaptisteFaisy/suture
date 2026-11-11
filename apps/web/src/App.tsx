import { useMemo, useState, type ReactNode } from "react";
import { translateCommon } from "./i18n/common";
import { detectLang, LangContext, type Lang } from "./i18n/lang";
import { Footer, Header } from "./layout";
import { NavigationContext, type ScreenName, type ScreenParams } from "./router";
import { CellHistoryScreen } from "./screens/cell-history/CellHistoryScreen";
import { CombineScreen } from "./screens/combine/CombineScreen";
import { CompareScreen } from "./screens/compare/CompareScreen";
import { HomeScreen } from "./screens/home/HomeScreen";
import { SettingsScreen } from "./screens/settings/SettingsScreen";
import { WorkbookScreen } from "./screens/workbook/WorkbookScreen";
import { StoreContext, type StoreAdapter, type WorkbookSummary } from "./store";

const SCREENS: Record<ScreenName, () => ReactNode> = {
  home: () => <HomeScreen />,
  workbook: () => <WorkbookScreen />,
  compare: () => <CompareScreen />,
  combine: () => <CombineScreen />,
  "cell-history": () => <CellHistoryScreen />,
  settings: () => <SettingsScreen />,
};

/** Stub adapter: keeps every screen renderable before the engines land. */
function useStubStore(openWorkbook: (id: string) => void): StoreAdapter {
  return useMemo(
    () => ({
      workbooks: [] as WorkbookSummary[],
      status: "idle" as const,
      error: null,
      demoAvailable: false,
      openWorkbook,
      trackFile: async () => undefined,
      loadDemo: async () => undefined,
    }),
    [openWorkbook],
  );
}

export function App() {
  const [lang, setLang] = useState<Lang>(detectLang());
  const [screen, setScreen] = useState<ScreenName>("home");
  const [params, setParams] = useState<ScreenParams>({});
  const [stack, setStack] = useState<{ screen: ScreenName; params: ScreenParams }[]>([]);

  const go = (next: ScreenName, nextParams: ScreenParams = {}) => {
    setStack((previous) => [...previous, { screen, params }]);
    setScreen(next);
    setParams(nextParams);
  };

  const back = () => {
    const last = stack[stack.length - 1];
    if (last === undefined) return;
    setStack((previous) => previous.slice(0, -1));
    setScreen(last.screen);
    setParams(last.params);
  };

  const store = useStubStore((id) => go("workbook", { workbookId: id }));
  const t = (key: string) => translateCommon(lang, key);
  const renderScreen = SCREENS[screen];

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <NavigationContext.Provider value={{ screen, params, go, back }}>
        <StoreContext.Provider value={store}>
          <div className="shell">
            <Header />
            <main>
              <p className="tagline">{t("app.tagline")}</p>
              {renderScreen()}
            </main>
            <Footer />
          </div>
        </StoreContext.Provider>
      </NavigationContext.Provider>
    </LangContext.Provider>
  );
}
