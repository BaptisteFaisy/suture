/**
 * Typed refusals of the OOXML boundary.
 *
 * Every refusal is a `SutureFileError` carrying a machine-readable code and a
 * message written for the end user (English, no jargon).
 */
import { SutureFileError } from "@suture/contracts";
import type { FileErrorCode } from "@suture/contracts";

/** Build a typed refusal. */
export function refuse(code: FileErrorCode, message: string): SutureFileError {
  return new SutureFileError(code, message);
}

/** True when the thrown value is a typed refusal raised by this package. */
export function isFileError(error: unknown): error is SutureFileError {
  return error instanceof SutureFileError;
}

/**
 * Describe a refusal in a way the UI can show to the user.
 * Falls back to the raw message for unknown errors.
 */
export function describeRefusal(error: unknown): string {
  return isFileError(error) ? error.message : "This file could not be read.";
}
