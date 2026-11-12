import type { StoreAdapter } from "../../store";
import { MilestoneDialog, RestoreDialog } from "./MilestoneDialog";
import type { WorkbookActions } from "./useWorkbookScreen";

/**
 * The two dialogs of screen 2: naming a version (SUT-F-28) and restoring one
 * (SUT-F-27). Both go through the store only after an explicit confirmation.
 */
export function WorkbookDialogs(props: {
  readonly actions: WorkbookActions;
  readonly store: StoreAdapter;
  readonly t: (key: string) => string;
}) {
  const { actions, store, t } = props;
  const milestone = actions.state.milestoneFor;
  const restore = actions.state.restoreFor;

  return (
    <>
      <MilestoneDialog
        open={milestone !== null}
        currentName={milestone?.milestone}
        t={t}
        onCancel={() => actions.askMilestone(null)}
        onSave={(name) => {
          actions.askMilestone(null);
          if (milestone !== null) {
            void actions.run(
              () => store.setMilestone(milestone.id, name),
              t("status.milestoneSet"),
            );
          }
        }}
      />
      <RestoreDialog
        open={restore !== null}
        note={restore?.note ?? ""}
        t={t}
        onCancel={() => actions.askRestore(null)}
        onConfirm={() => {
          actions.askRestore(null);
          if (restore !== null) {
            void actions.run(
              () => store.restoreVersion(restore.id),
              t("status.restored"),
            );
          }
        }}
      />
    </>
  );
}
