import { describe, expect, it } from "vitest";
import { GROUP_SEPARATOR } from "@suture/ui";
import type { ComparisonFilter, ComparisonRow, ComparisonView } from "../../store";
import {
  applyComparisonFilter,
  buildSummary,
  counted,
  detailOf,
  isIdentical,
  natureOf,
  sheetIdsOf,
  symbolFor,
  symbolLabel,
  summaryCounts,
} from "./logic";
import { screenMessages, translateScreen } from "./messages";

const en = (key: string) => translateScreen("en", key);
const fr = (key: string) => translateScreen("fr", key);
const grouped = (digits: string) => digits.replace(/,/g, GROUP_SEPARATOR);

function row(patch: Partial<ComparisonRow>): ComparisonRow {
  return { sheetId: 1, ref: "B7", nature: "input", before: "1", after: "2", ...patch };
}

function view(rows: ComparisonRow[]): ComparisonView {
  return {
    rows,
    summary: {
      inputsModified: rows.filter((entry) => entry.nature === "input").length,
      consequences: rows.filter((entry) => entry.nature === "consequence").length,
      formats: rows.filter((entry) => entry.nature === "format").length,
      rowsInserted: 1,
      rowsDeleted: 0,
      colsInserted: 0,
      colsDeleted: 0,
      partsChanged: 0,
    },
    otherParts: [],
    filter: { sheetId: "all", nature: "all" },
  };
}

const EMPTY: ComparisonView = {
  rows: [],
  summary: {
    inputsModified: 0,
    consequences: 0,
    formats: 0,
    rowsInserted: 0,
    rowsDeleted: 0,
    colsInserted: 0,
    colsDeleted: 0,
    partsChanged: 0,
  },
  otherParts: [],
  filter: { sheetId: "all", nature: "all" },
};

/** A comparison whose only differences are structural columns. */
function columnsOnly(colsInserted: number, colsDeleted: number): ComparisonView {
  return { ...EMPTY, summary: { ...EMPTY.summary, colsInserted, colsDeleted } };
}

describe("nature and symbol (SUT-N-07)", () => {
  it("maps the three natures to a symbol", () => {
    expect(symbolFor(row({ nature: "input" }))).toBe("+");
    expect(symbolFor(row({ nature: "consequence" }))).toBe("~");
    expect(symbolFor(row({ nature: "format" }))).toBe("≡");
  });

  it("uses the removed symbol when the value disappears", () => {
    expect(symbolFor(row({ after: "" }))).toBe("−");
    expect(symbolFor(row({ after: "   " }))).toBe("−");
  });

  it("names every symbol in both languages", () => {
    expect(symbolLabel(row({ nature: "input" }), en)).toBe("Typed change");
    expect(symbolLabel(row({ nature: "consequence" }), fr)).toBe("Conséquence recalculée");
    expect(symbolLabel(row({ after: "" }), en)).toBe("Removed");
    expect(symbolLabel(row({ nature: "format" }), fr)).toBe("Format modifié");
  });

  it("keeps the three natures of the comparison (B.7)", () => {
    expect(natureOf(row({ nature: "input" }))).toBe("input");
    expect(natureOf(row({ nature: "consequence" }))).toBe("consequence");
    expect(natureOf(row({ nature: "format" }))).toBe("format");
  });
});

describe("filter pipeline", () => {
  const rows = [
    row({ sheetId: 1, ref: "B7" }),
    row({ sheetId: 2, ref: "A1", nature: "consequence" }),
    row({ sheetId: 1, ref: "C3", nature: "format" }),
  ];

  it("narrows by sheet and by nature", () => {
    const bySheet: ComparisonFilter = { sheetId: 1, nature: "all" };
    expect(applyComparisonFilter(rows, bySheet).map((entry) => entry.ref)).toEqual(["B7", "C3"]);
    const byNature: ComparisonFilter = { sheetId: "all", nature: "consequence" };
    expect(applyComparisonFilter(rows, byNature).map((entry) => entry.ref)).toEqual(["A1"]);
    expect(applyComparisonFilter(rows, { sheetId: "all", nature: "all" })).toHaveLength(3);
  });

  it("is idempotent", () => {
    const filter: ComparisonFilter = { sheetId: 1, nature: "all" };
    const once = applyComparisonFilter(rows, filter);
    expect(applyComparisonFilter(once, filter)).toEqual(once);
  });

  it("never invents a row", () => {
    for (const entry of applyComparisonFilter(rows, { sheetId: 1, nature: "all" })) {
      expect(rows).toContain(entry);
    }
  });

  it("lists the distinct sheets in ascending order", () => {
    expect(sheetIdsOf(rows)).toEqual([1, 2]);
    expect(sheetIdsOf([])).toEqual([]);
  });
});

describe("deterministic summary (SUT-F-13)", () => {
  it("builds the headline from the contract counts", () => {
    const rows = [
      row({ ref: "B7" }),
      row({ ref: "B9" }),
      row({ ref: "C1" }),
      row({ ref: "B14", nature: "consequence" }),
    ];
    expect(buildSummary(view(rows), [], "en", en).headline).toBe(
      "3 typed changes, 1 row added, 1 result recalculated",
    );
  });

  it("details the recalculated results with their amounts", () => {
    const rows = [row({ ref: "B14", nature: "consequence", before: "120000", after: "131500" })];
    expect(buildSummary(view(rows), rows, "en", en).details).toEqual([
      `B14: ${grouped("120,000")} → ${grouped("131,500")}`,
    ]);
  });

  it("names the cell when the engine provides a label", () => {
    const labelled = {
      ...row({ ref: "B14", nature: "consequence" as const, before: "120000", after: "131500" }),
      label: "Total",
    };
    expect(detailOf(labelled, "en")).toBe(
      `Total (B14): ${grouped("120,000")} → ${grouped("131,500")}`,
    );
  });

});

describe("deterministic summary — locales and counts", () => {
  it("follows the French separators and spacing (SUT-N-08)", () => {
    const rows = [row({ ref: "B14", nature: "consequence", before: "120000", after: "131500.5" })];
    expect(detailOf(rows[0]!, "fr")).toBe(
      `B14 : ${grouped("120,000")} → ${grouped("131,500")},5`,
    );
    expect(buildSummary(view(rows), rows, "fr", fr).headline).toBe(
      "1 ligne ajoutée, 1 résultat recalculé",
    );
  });

  it("produces a copyable plain text", () => {
    const rows = [row({ ref: "B14", nature: "consequence", before: "120000", after: "131500" })];
    expect(buildSummary(view(rows), rows, "en", en).plain).toBe(
      `1 row added, 1 result recalculated\nB14: ${grouped("120,000")} → ${grouped("131,500")}`,
    );
  });

  it("reads the counts from the contract, never from the rows", () => {
    const lied: ComparisonView = { ...view([]), summary: { ...EMPTY.summary, inputsModified: 7 } };
    expect(summaryCounts(lied).inputsModified).toBe(7);
    expect(buildSummary(lied, [], "en", en).headline).toBe("7 typed changes");
  });

  it("is deterministic: the same input gives the same text", () => {
    const rows = [row({}), row({ ref: "C4", nature: "consequence" })];
    expect(buildSummary(view(rows), rows, "en", en)).toEqual(
      buildSummary(view(rows), rows, "en", en),
    );
  });

  it("picks the singular form below two", () => {
    expect(counted(en, "en", "summary.inputs", 1)).toBe("1 typed change");
    expect(counted(en, "en", "summary.inputs", 3)).toBe("3 typed changes");
    expect(counted(fr, "fr", "summary.rowsAdded", 1)).toBe("1 ligne ajoutée");
    expect(counted(fr, "fr", "summary.rowsAdded", 3)).toBe("3 lignes ajoutées");
  });
});

describe("columns in the summary", () => {
  it("counts the columns that were added and removed, in both languages", () => {
    expect(buildSummary(columnsOnly(2, 1), [], "en", en).headline).toBe(
      "2 columns added, 1 column removed",
    );
    expect(buildSummary(columnsOnly(2, 1), [], "fr", fr).headline).toBe(
      "2 colonnes ajoutées, 1 colonne supprimée",
    );
  });

  it("keeps the column counts next to the row counts", () => {
    const withRows: ComparisonView = {
      ...columnsOnly(1, 0),
      summary: { ...columnsOnly(1, 0).summary, rowsInserted: 2 },
    };
    expect(buildSummary(withRows, [], "en", en).headline).toBe("2 rows added, 1 column added");
  });

  it("reads the column counts from the contract, never from the rows", () => {
    expect(summaryCounts(columnsOnly(4, 3)).colsAdded).toBe(4);
    expect(summaryCounts(columnsOnly(4, 3)).colsRemoved).toBe(3);
  });

  it("picks the singular form for one column", () => {
    expect(counted(en, "en", "summary.colsAdded", 1)).toBe("1 column added");
    expect(counted(en, "en", "summary.colsRemoved", 1)).toBe("1 column removed");
    expect(counted(fr, "fr", "summary.colsAdded", 1)).toBe("1 colonne ajoutée");
    expect(counted(fr, "fr", "summary.colsRemoved", 2)).toBe("2 colonnes supprimées");
  });
});

describe("empty states", () => {
  it("detects an identical workbook", () => {
    expect(isIdentical(EMPTY)).toBe(true);
  });

  it("reports a comparison that holds differences", () => {
    expect(isIdentical(view([row({})]))).toBe(false);
  });

  it("is not identical when only the columns changed", () => {
    expect(isIdentical(columnsOnly(1, 0))).toBe(false);
    expect(isIdentical(columnsOnly(0, 1))).toBe(false);
  });
});

// The list below is the very list the CI guard forbids in the interface; the
// trailing marker keeps the guard from reading its own mirror as a violation.
const FORBIDDEN = [ // vg-allow-line
  "git", "commit", "branch", "merge", "diff", "conflict", "repository", "repo", // vg-allow-line
  "tag", "revert", "blame", "checkout", "stash", "clone", "push", "pull", // vg-allow-line
  "dépôt", "branche", "fusion", "conflit", "étiquette", // vg-allow-line
];

describe("vocabulary (SUT-N-09)", () => {
  it("keeps every message free of forbidden terms", () => {
    for (const lang of ["en", "fr"] as const) {
      for (const [key, text] of Object.entries(screenMessages[lang])) {
        for (const word of FORBIDDEN) {
          const pattern = new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, "iu");
          expect(pattern.test(text), `${lang}/${key}: ${word}`).toBe(false);
        }
      }
    }
  });

  it("translates every key in both languages", () => {
    const keys = Object.keys(screenMessages.en).sort();
    expect(Object.keys(screenMessages.fr).sort()).toEqual(keys);
    for (const key of keys) {
      expect(screenMessages.fr[key]!.length).toBeGreaterThan(0);
    }
  });
});
