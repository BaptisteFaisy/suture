import type { Navigation, ScreenName } from "../../router";

/**
 * Actions that leave the workbook screen: comparing two versions (screen 3)
 * and combining two scenarios (screen 4).
 */
export function WorkbookNavBar(props: {
  nav: Navigation;
  workbookId: string | undefined;
  t: (key: string) => string;
}) {
  const go = (screen: ScreenName) => () =>
    props.nav.go(screen, { workbookId: props.workbookId });
  return (
    <div className="workbook-actions">
      <button type="button" onClick={go("compare")}>
        {props.t("action.compare")}
      </button>
      <button type="button" onClick={go("combine")}>
        {props.t("action.combine")}
      </button>
    </div>
  );
}
