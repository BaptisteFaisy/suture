/**
 * Milestone dialog (SUT-F-28) — name a version, e.g. "Budget adopted on
 * 12 November". Thin wrapper over the shared Dialog shell.
 */
import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";

export interface MilestoneDialogProps {
  readonly open: boolean;
  readonly currentName?: string;
  readonly t: (key: string) => string;
  readonly onSave: (name: string) => void;
  readonly onCancel: () => void;
}

export function MilestoneDialog(props: MilestoneDialogProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (props.open) setName(props.currentName ?? "");
  }, [props.open, props.currentName]);

  return (
    <Dialog
      open={props.open}
      title={props.t("milestone.title")}
      hint={props.t("milestone.hint")}
      t={props.t}
      onDismiss={props.onCancel}
      confirmLabel={props.t("milestone.save")}
      onConfirm={() => {
        const trimmed = name.trim();
        if (trimmed !== "") props.onSave(trimmed);
      }}
    >
      <label className="visually-hidden" htmlFor="milestone-input">
        {props.t("milestone.inputLabel")}
      </label>
      <input
        id="milestone-input"
        name="milestone-input"
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && name.trim() !== "") {
            event.preventDefault();
            props.onSave(name.trim());
          }
        }}
      />
    </Dialog>
  );
}

/**
 * Restore confirmation (SUT-F-27) — explains that nothing is erased: the
 * restore adds a new version with the same content.
 */
export function RestoreDialog(props: {
  readonly open: boolean;
  readonly note: string;
  readonly t: (key: string) => string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <Dialog
      open={props.open}
      title={props.t("restore.title")}
      hint={props.t("restore.hint")}
      t={props.t}
      onDismiss={props.onCancel}
      confirmLabel={props.t("restore.confirm")}
      onConfirm={props.onConfirm}
    >
      <p className="dialog-subject">{props.note}</p>
      <p className="dialog-reassurance">{props.t("restore.reassurance")}</p>
    </Dialog>
  );
}
