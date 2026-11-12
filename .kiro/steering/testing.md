# Suture — Testing Steering

_Always included. Testing rules, fast-check property definitions, seeds._

## Testing rules

1. **Every business requirement has a test.**
2. **Every property from SUT-P-01 to SUT-P-12 is automated with fast-check.**
3. **Seeds are printed on failure and recorded in `KIRO_JOURNAL.md`.**
4. Unit and property tests must run in under 30 seconds total (in-memory, no
   disk I/O except reading test fixtures).
5. Fast-check runs ≥ 100 runs per property in CI; 1,000 runs when run locally.
6. **No network** in tests.
7. Any counterexample discovered by fast-check must be:
   - converted into a deterministic regression test in `<name>.test.ts`,
   - logged in `KIRO_JOURNAL.md` under section "Property-based testing findings".

## The 12 Properties (Binding specification)

| Id | Property | Implemented in |
|---|---|---|
| **SUT-P-01** | `unzip(zip(parts)) == parts` byte-for-byte. | `packages/ooxml-io` |
| **SUT-P-02** | `derive(parts)` is strictly deterministic and invariant to ZIP entry order. | `packages/canonical` |
| **SUT-P-03** | For any valid formula and position: `r1c1ToA1(a1ToR1c1(f, pos), pos) == f`. | `packages/formula` |
| **SUT-P-04** | `diff(W, W) == emptyChangeSet`. | `packages/diff` |
| **SUT-P-05** | Inserting $k$ arbitrary rows in sheet gives exactly $k$ row insertions and 0 modified inputs. | `packages/diff` |
| **SUT-P-06** | `combine(O, A, O) == A`, `combine(O, O, B) == B`, `combine(O, X, X) == X`. | `packages/merge` |
| **SUT-P-07** | Two disjoint sets of cell modifications with unchanged structure yield 0 disagreements. | `packages/merge` |
| **SUT-P-08** | **No silent loss:** every change in $\Delta A \cup \Delta B$ is either applied, disagreed, or listed in report; none disappears. | `packages/merge` |
| **SUT-P-09** | `combine(O, A, B)` and `combine(O, B, A)` yield identical cell states, up to swapped disagreement sides. | `packages/merge` |
| **SUT-P-10** | After patch, every OOXML part except modified sheets, workbook and calcChain is byte-for-byte identical to carrier. | `packages/ooxml-patch` |
| **SUT-P-11** | Reading a patched file back with `canonical` reproduces exactly the expected cells. | `packages/ooxml-patch` |
| **SUT-P-12** | Every committed version can be restored identically; restoring a version appends a commit and removes none. | `packages/git-store` |
