/**
 * Application router — a tiny state machine (no router dependency).
 * Every screen is addressed by name plus optional params.
 */
import { createContext, useContext } from "react";

export type ScreenName =
  | "home"
  | "workbook"
  | "compare"
  | "combine"
  | "cell-history"
  | "settings";

/** Params carried between screens (kept minimal and explicit). */
export interface ScreenParams {
  /** Tracked workbook id (screens 2-5). */
  workbookId?: string;
  /** Version ids to compare (screen 3). */
  fromVersion?: string;
  toVersion?: string;
  /** Scenario names to combine (screen 4). */
  scenarioA?: string;
  scenarioB?: string;
  /** Cell address for the history panel (screen 5). */
  sheetId?: number;
  ref?: string;
}

export interface Navigation {
  screen: ScreenName;
  params: ScreenParams;
  go(screen: ScreenName, params?: ScreenParams): void;
  back(): void;
}

export const NavigationContext = createContext<Navigation | null>(null);

export function useNavigation(): Navigation {
  const nav = useContext(NavigationContext);
  if (nav === null) {
    throw new Error("useNavigation must be used inside NavigationContext");
  }
  return nav;
}
