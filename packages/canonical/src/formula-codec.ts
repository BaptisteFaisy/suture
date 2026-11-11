/**
 * Adapter over `@suture/formula`.
 *
 * The formula package owns the A1 ↔ L1C1 conversion and the reference shifting.
 * This module normalizes its export shapes, and falls back to the internal
 * converter of `fallback-formula.ts` while that package does not expose a codec
 * yet — so the canonical view never depends on a package still in flight.
 */
import * as formulaPackage from "@suture/formula";
import { a1ToR1c1 as fallbackA1ToR1c1, shiftA1 as fallbackShiftA1 } from "./fallback-formula";

/** Result of a formula conversion, whatever the shape of the codec. */
export interface ConversionResult {
  formula: string;
  /** True when the codec could not translate the formula faithfully. */
  needsCheck: boolean;
}

/** The two formula operations the canonical derivation needs. */
export interface FormulaCodec {
  a1ToR1c1(formula: string, origin: { row: number; col: number }): ConversionResult;
  shiftA1(formula: string, dRow: number, dCol: number): ConversionResult;
}

type UnknownRecord = Record<string, unknown>;
type AnyFunction = (...args: unknown[]) => unknown;

/** Codec built on the internal converter (used when `@suture/formula` is silent). */
export function fallbackCodec(): FormulaCodec {
  return {
    a1ToR1c1: (formula, origin) => ({ formula: fallbackA1ToR1c1(formula, origin), needsCheck: false }),
    shiftA1: (formula, dRow, dCol) => ({ formula: fallbackShiftA1(formula, dRow, dCol), needsCheck: false }),
  };
}

/**
 * Reads the codec exposed by `@suture/formula`, or the internal fallback when
 * that package does not export `a1ToR1c1` / `shiftA1` yet.
 */
export function resolveFormulaCodec(): FormulaCodec {
  const holder = findHolder(formulaPackage as unknown as UnknownRecord);
  const a1ToR1c1 = pickFunction(holder, "a1ToR1c1");
  const shiftA1 = pickFunction(holder, "shiftA1");
  if (!a1ToR1c1 || !shiftA1) return fallbackCodec();
  return {
    a1ToR1c1: (formula, origin) => normalize(a1ToR1c1(formula, origin), formula),
    shiftA1: (formula, dRow, dCol) => normalize(shiftA1(formula, dRow, dCol), formula),
  };
}

/** Looks for the object carrying the codec functions, at any depth of one. */
function findHolder(module: UnknownRecord): UnknownRecord {
  const candidates: UnknownRecord[] = [module];
  for (const value of Object.values(module)) {
    if (typeof value === "object" && value !== null) candidates.push(value as UnknownRecord);
    if (typeof value === "function") {
      const produced = tryCall(value as AnyFunction);
      if (typeof produced === "object" && produced !== null) {
        candidates.push(produced as UnknownRecord);
      }
    }
  }
  for (const candidate of candidates) {
    if (pickFunction(candidate, "a1ToR1c1") && pickFunction(candidate, "shiftA1")) return candidate;
  }
  return module;
}

/** Calls a factory-like export, swallowing any failure. */
function tryCall(fn: AnyFunction): unknown {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

/** Reads a function property, if it is callable. */
function pickFunction(holder: UnknownRecord, name: string): AnyFunction | undefined {
  const value = holder[name];
  return typeof value === "function" ? (value as AnyFunction) : undefined;
}

/** Normalizes a conversion result: keep the original text when unusable. */
function normalize(result: unknown, fallback: string): ConversionResult {
  if (typeof result === "string") return { formula: result, needsCheck: false };
  if (typeof result !== "object" || result === null) {
    return { formula: fallback, needsCheck: true };
  }
  const record = result as UnknownRecord;
  const formula = record["formula"];
  if (typeof formula !== "string") return { formula: fallback, needsCheck: true };
  const issues = record["issues"];
  const hasIssues = Array.isArray(issues) && issues.length > 0;
  const failed = record["ok"] === false || record["needsCheck"] === true || hasIssues;
  return { formula, needsCheck: failed };
}
