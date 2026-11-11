import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OoxmlParts } from "@suture/contracts";
import { patchWorkbook } from "./index";
import { buildCarrier } from "../test/generators";

/**
 * Smoke test: a workbook is patched, re-zipped and opened by a headless
 * office suite. It proves the file is not corrupt — the risk the project
 * carries (B.16: "the combined file is refused or repaired by Excel").
 *
 * The test needs `soffice`, `unzip` and `zip`; it is skipped when they are
 * missing, so the suite stays green on a bare runner.
 */
const HAS_TOOLS = ["soffice", "unzip", "zip"].every((tool) => {
  try {
    execFileSync("which", [tool]);
    return true;
  } catch {
    return false;
  }
});

function unzip(dir: string, archive: string): OoxmlParts {
  execFileSync("unzip", ["-o", "-q", archive, "-d", dir], { timeout: 30_000 });
  const parts: OoxmlParts = [];
  const walk = (current: string, prefix: string) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full, `${prefix}${entry}/`);
        continue;
      }
      parts.push({ path: `${prefix}${entry}`, data: new Uint8Array(readFileSync(full)) });
    }
  };
  walk(dir, "");
  return parts;
}

function zip(parts: OoxmlParts, target: string): void {
  const out = join(target, "..", "content");
  mkdirSync(out, { recursive: true });
  for (const part of parts) {
    const file = join(out, part.path);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, part.data);
  }
  execFileSync("zip", ["-r", "-q", "-X", target, "."], { cwd: out, timeout: 30_000 });
}

function convertToCsv(workbook: string, work: string): string {
  execFileSync("soffice", [
    "--headless",
    `-env:UserInstallation=file://${join(work, "profile")}`,
    "--convert-to",
    "csv",
    workbook,
    "--outdir",
    join(work, "csv"),
  ], { timeout: 60_000 });
  return readFileSync(join(work, "csv", "patched.csv"), "utf8");
}

describe.skipIf(!HAS_TOOLS)("smoke — a patched workbook opens without repair", () => {
  it("keeps the values and opens in a headless office suite", () => {
    const work = mkdtempSync(join(tmpdir(), "suture-smoke-"));
    const carrier = join(work, "carrier.xlsx");
    zip(buildCarrier(), carrier);
    const parts = unzip(join(work, "carrier"), carrier);
    const result = patchWorkbook(parts, {
      patches: [
        {
          sheetId: 1,
          ref: "B2",
          record: { ref: "B2", kind: "n", input: "99999", cached: "", fmt: "" },
          source: "A",
        },
        {
          sheetId: 1,
          ref: "C2",
          record: { ref: "C2", kind: "s", input: "Nouvelle ligne", cached: "", fmt: "" },
          source: "A",
        },
      ],
      sheetPaths: new Map([[1, "xl/worksheets/sheet1.xml"]]),
      originMarker: { versionId: "abc123", scenario: "smoke" },
    });
    const target = join(work, "patched.xlsx");
    zip(result.parts, target);
    const csv = convertToCsv(target, work);
    expect(csv).toContain("99999");
    expect(csv).toContain("Nouvelle ligne");
    expect(existsSync(target)).toBe(true);
  });
});