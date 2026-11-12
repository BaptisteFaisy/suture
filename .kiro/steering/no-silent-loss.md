# Suture — No Silent Loss Guarantee

_Always included. Core business invariant of the Frankenstein combine engine._

## The Invariant

Given a common origin workbook $O$ and two divergent versions $A$ and $B$:

$$\Delta A = \text{diff}(O, A)$$
$$\Delta B = \text{diff}(O, B)$$

Let $U = \Delta A \cup \Delta B$ be the set of all atomic changes (cells, rows,
columns, sheets, non-cell parts) introduced by either side.

After running `combine(O, A, B)` and producing a combined workbook $C$, a set of
disagreements $D$ and a combine report $R$:

**Every single element $u \in U$ MUST belong to EXACTLY ONE of three partitions:**

1. **Applied in $C$** — the change was accepted into the combined workbook.
2. **Recorded in $D$** — a disagreement was presented to the user, who picked A,
   B, or typed a custom value.
3. **Listed in $R$** — the change could not be automatically combined (safe
   fallback, carrier mismatch for non-cell parts, formula range to check) and is
   explicitly listed in the report so the user can review it.

$$\forall u \in U,\quad u \in \text{Applied}(C) \oplus u \in D \oplus u \in R$$

**A change may NEVER disappear silently.**

Property `SUT-P-08` in `packages/merge` verifies this invariant over thousands
of randomly generated workbooks and change sets using fast-check.

## Four Structural Cases

| Case (per sheet) | Resolution strategy | Carrier file |
|---|---|---|
| **1. Neither side changed structure** | Three-way merge cell by cell. Non-conflicting inputs apply automatically. | Side A |
| **2. Exactly one side inserted/deleted rows or columns** | Carrier is that side. Changes from the other side are mapped through the row/col alignment table. | The side with structural edits |
| **3. Both sides performed identical structural edits** | Reduced to Case 1 on the aligned grid. | Side A |
| **4. Both sides changed structure differently** | **Safe fallback:** no automatic merge for this sheet. User picks which side's structure to keep; the other side's changes are listed in the report to be applied by hand. | User's choice (A or B) |
