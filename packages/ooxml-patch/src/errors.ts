/**
 * Typed errors raised by the patcher.
 *
 * The frozen contracts do not define a patch-specific error type yet, so the
 * patcher declares its own stable codes. Callers map them to a message.
 */

/** Stable machine-readable reason of a patch failure. */
export type PatchErrorCode =
  | "sheet-part-missing"
  | "sheet-id-unknown"
  | "malformed-sheet-xml"
  | "invalid-cell-ref"
  | "duplicate-cell-patch"
  | "invalid-cell-value"
  | "custom-props-unreadable";

/** Typed failure raised by `@suture/ooxml-patch`. */
export class PatchError extends Error {
  constructor(
    readonly code: PatchErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PatchError";
  }
}
