import type { FileErrorCode } from "@suture/contracts";

/**
 * Refusal messages (SUT-F-04): every way a workbook can be rejected has a
 * clear, translatable explanation. The keys live in the shared dictionary so
 * both languages stay in sync.
 */
export type FileErrorKey =
  | "error.not-a-zip"
  | "error.encrypted"
  | "error.unsupported-format"
  | "error.corrupt"
  | "error.too-large"
  | "error.too-many-entries"
  | "error.zip-bomb"
  | "error.too-many-cells"
  | "error.missing-workbook"
  | "error.generic";

const KEYS: Record<FileErrorCode, FileErrorKey> = {
  "not-a-zip": "error.not-a-zip",
  encrypted: "error.encrypted",
  "unsupported-format": "error.unsupported-format",
  corrupt: "error.corrupt",
  "too-large": "error.too-large",
  "too-many-entries": "error.too-many-entries",
  "zip-bomb": "error.zip-bomb",
  "too-many-cells": "error.too-many-cells",
  "missing-workbook": "error.missing-workbook",
};

/** Message key for a refusal code, with a generic fallback. */
export function fileErrorKey(code: string): FileErrorKey {
  return KEYS[code as FileErrorCode] ?? "error.generic";
}

/** True when the thrown value is one of our typed refusals. */
export function hasErrorCode(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}
