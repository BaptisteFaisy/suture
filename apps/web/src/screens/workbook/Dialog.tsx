/**
 * Modal dialog shell — one implementation reused by every confirmation and
 * form dialog of this screen (focus, Escape, click-outside to dismiss).
 */
import { useEffect, useRef, type ReactNode } from "react";

export interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly hint?: string;
  readonly t: (key: string) => string;
  readonly onDismiss: () => void;
  readonly onConfirm?: () => void;
  readonly confirmLabel?: string;
  readonly children?: ReactNode;
}

export function Dialog(props: DialogProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!props.open) return undefined;
    const previous = document.activeElement;
    const focusable = boxRef.current?.querySelector<HTMLElement>(
      "input, textarea, select, button",
    );
    focusable?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [props.open]);

  if (!props.open) return null;
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onDismiss();
      }}
    >
      <div
        className="dialog-box"
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") props.onDismiss();
        }}
      >
        <h3 id="dialog-title">{props.title}</h3>
        {props.hint !== undefined && <p className="dialog-hint">{props.hint}</p>}
        {props.children}
        <div className="dialog-actions">
          <button type="button" onClick={props.onDismiss}>
            {props.t("action.cancel")}
          </button>
          {props.onConfirm !== undefined && (
            <button type="button" className="dialog-confirm" onClick={props.onConfirm}>
              {props.confirmLabel ?? props.t("action.confirm")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
