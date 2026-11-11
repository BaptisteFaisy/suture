import { describe, expect, it } from "vitest";
import { ensureFullCalcOnLoad } from "./calc-chain";

const HEAD = '<?xml version="1.0"?><workbook><sheets><sheet name="Budget"/></sheets>';

describe("ensureFullCalcOnLoad", () => {
  it("sets the flag on an existing self-closing calcPr", () => {
    const xml = `${HEAD}<calcPr calcId="171027"/></workbook>`;
    expect(ensureFullCalcOnLoad(xml)).toContain('<calcPr calcId="171027" fullCalcOnLoad="1"/>');
  });

  it("sets the flag on an existing calcPr with content", () => {
    const xml = `${HEAD}<calcPr calcId="171027"></calcPr></workbook>`;
    expect(ensureFullCalcOnLoad(xml)).toContain('<calcPr calcId="171027" fullCalcOnLoad="1">');
  });

  it("replaces an existing flag", () => {
    const xml = `${HEAD}<calcPr calcId="1" fullCalcOnLoad="0"/></workbook>`;
    expect(ensureFullCalcOnLoad(xml)).toContain('fullCalcOnLoad="1"');
    expect(ensureFullCalcOnLoad(xml)).not.toContain('fullCalcOnLoad="0"');
  });

  it("creates the element when the workbook has none", () => {
    const xml = `${HEAD}</workbook>`;
    expect(ensureFullCalcOnLoad(xml)).toContain('<calcPr calcId="0" fullCalcOnLoad="1"/>');
  });

  it("inserts the element before the trailing parts", () => {
    const xml = `${HEAD}<extLst><ext uri="x"/></extLst></workbook>`;
    const result = ensureFullCalcOnLoad(xml);
    expect(result.indexOf("<calcPr")).toBeLessThan(result.indexOf("<extLst"));
  });
});
