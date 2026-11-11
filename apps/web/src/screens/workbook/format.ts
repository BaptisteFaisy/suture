/**
 * Locale-aware formatting helpers shared by the screens of this folder.
 * English is the default, French is the second language (SUT-N-08).
 */
import type { Lang } from "../../i18n/lang";

/** Replaces {placeholders} in a translated message. */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

/** "12 November 2026" (en) / "12 novembre 2026" (fr). */
export function formatDate(timestamp: number, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

/** "12 November 2026 at 09:30". */
export function formatDateTime(timestamp: number, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

/** A percentage written the way the interface language writes it. */
export function formatPercent(ratio: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(ratio);
}

/** A size written in the unit that fits (KB, MB). */
export function formatBytes(bytes: number, lang: Lang): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const number = new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    maximumFractionDigits: value < 10 && unit > 0 ? 1 : 0,
  }).format(value);
  return `${number} ${units[unit]}`;
}
