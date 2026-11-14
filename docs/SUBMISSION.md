# Submission kit — Suture (Kiroween 2026)

Textes prêts à coller dans le formulaire Devpost, plus les brouillons du billet
de blog et de la publication sociale (les deux bonus). Tout ce qui suit est en
anglais, comme l'exige le règlement. Les notes entre crochets sont pour toi, à
supprimer avant publication.

---

## 1. Formulaire Devpost

### Project name

```
Suture
```

### Tagline / short description

```
Version control for spreadsheets, without the word Git.
```

### Category

**Frankenstein** — Suture stitches together four things that had no business
meeting: real Git plumbing (`isomorphic-git`), Excel `.xlsx` archives (OOXML),
a three-way merge at cell level, and office vocabulary.

### Links

| Champ | Valeur |
|---|---|
| Live app | `https://tradoooo.github.io/suture/` |
| Repository | `https://github.com/BaptisteFaisy/suture` |
| Video | [à coller après tournage] |
| Blog post (bonus) | [à coller après publication] |
| Social post (bonus) | [à coller après publication] |

### Description of features

```
Suture is a browser app for people who exchange Excel workbooks by email and
have never heard the word "Git". Nothing is installed, nothing is uploaded:
every byte stays in the browser.

What it does:

- Track a workbook. Drop a .xlsx (or .xlsm) file and it becomes a tracked
  workbook with a first version. Drop the edited file again and Suture shows
  what changed before recording anything: "3 edited entries, 1 row added,
  14 recalculated results" — separating what a person typed from what the
  spreadsheet recomputed.
- Compare two versions. A virtualised grid shows every difference with a
  symbol as well as a colour (+ added, − removed, ~ recalculated), filters by
  sheet and by nature, keyboard navigation, and a deterministic summary that a
  screen reader can read out.
- Scenarios. Try an assumption ("hire +2", "prices +5%") on a copy: the
  reference never moves.
- Combine two diverged files. This is the heart. Suture finds the common
  origin, applies everything that does not compete, and asks you about the
  rest: for each disagreement it shows the original value and both sides, and
  you pick A, B, or type your own value. The assistant runs in three steps —
  what applies on its own, what you must decide, then the report and the
  download.
- Two-file assistant. Got the original plus two copies back by email? Drop all
  three: Suture creates the scenarios and starts the combine.
- Safe fallback. When both sides changed the structure of the same sheet
  differently, Suture refuses to guess: you choose which side to keep, and
  every change from the other side is listed in the report so nothing is lost.
- Cell history. Click a cell: who changed it, when, with what note, and the
  values before and after.
- Restore. Go back to last Tuesday: this creates a new version identical to the
  old one. Nothing is ever erased.
- Export. A tracked workbook exports as an archive containing a real, clonable
  Git repository: `git log -p -- cells/` shows the history of every cell in
  plain text. It was Git all along — just never spoken.

The combined file opens in Excel without a repair prompt: Suture never
rebuilds a workbook, it patches only the cells of one side's file (the
"carrier"), so charts, formatting and macros survive byte for byte. The
calculation chain is dropped and a full recalculation is requested on opening.

Everything is local. After the page loads, no request leaves the browser —
there is an end-to-end test that asserts exactly that.
```

### Instructions for judges

```
1. Open https://tradoooo.github.io/suture/ (a private window is fine: no
   account, no cookie, no upload).
2. Click "Load the demo workbook". This loads the case from the pitch: an
   original budget, Paul's copy (three amounts corrected, one row added) and
   Marie's copy (one assumption changed, and one of the same amounts corrected
   differently).
3. Click the tracked workbook "budget-2026.xlsx": you see the history thread —
   one point per version, one parallel thread per scenario, and a visible
   stitch wherever two versions were combined.
4. Click "Combine two scenarios", pick Paul and Marie, then "Start the combine".
   - Step 1 shows what applies on its own (Marie's assumption).
   - Step 2 shows the single disagreement: cell B5, original 60000, Paul
     61000, Marie 62000. Pick a side; the combine stays blocked until every
     disagreement is decided.
   - Step 3 shows the report (applied / decided / not carried / to review) and
     downloads the combined workbook.
5. Open the downloaded file in Excel or LibreOffice: no repair prompt, the
   chart and the formatting are intact, and the totals recalculate.
6. Try "Compare two versions" for the grid and the deterministic summary, and
   the cell history panel on any cell.
7. To verify it really is Git: use the export panel on the workbook screen,
   unzip the archive, and run `git log -p -- cells/`.

The interface is in English by default; French is available from the language
picker in the header.
```

### Kiro usage story (the eight points the form asks for)

```
1. Overall strategy. The build was split into eight specs, one per lot, in
   dependency order: ooxml-io and formula-r1c1 first (everything downstream
   reads parts and formulas), then the canonical cell view, the version store,
   the diff engine, the patcher, the combine engine, and finally the two screen
   specs. Requirements-first for the business core, design-first where the
   architecture commands (merge-engine, the two screen specs), Quick Spec for
   the bounded surfaces (git-store).

2. Surfaces. Specs and steering in the IDE; four command hooks; two custom
   agents; one skill; property-based testing throughout. The headless CLI was
   not used (it needs a paid API key and the CI budget forbids a long review
   job on every push); Web sessions and Crew were not used either — the build
   ran locally, with the same rules applied by hand. MCP is declared in
   .kiro/settings/mcp.json but no server was needed.

3. Specs against "vibe coding" — measured, not asserted. The A1 ↔ R1C1
   conversion was written twice: once against the acceptance criteria of
   .kiro/specs/formula-r1c1, once from the prose of the brief alone. Both were
   run against the same generated corpus (400 draws). Result: 0 counterexamples
   for the spec-driven version, 187 for the prose-only one — it rewrote sheet
   names ("Sheet2!B5" became "ShR[-2]C[26018]!…"), table references
   ("Table1[Amount]" became "TaR[-9]C[24159][Amount]") and external workbooks.
   The experiment is replayable: `pnpm vitest run experiments`
   (experiments/spec-vs-vibe/compare.test.ts). The lesson: the value of the spec
   was not the algorithm, it was the list of cases to fail on.

4. Steering that made the difference. no-silent-loss.md turned "never lose a
   change" from an intention into a design rule with a property attached
   (SUT-P-08): every change from either side ends up applied, decided, or
   listed in the report. product.md moved the vocabulary rule ("no Git word in
   the interface") from review comments into a CI check. canonical-format.md
   pinned the exact TSV shape of the cell view, which the diff and combine
   engines both read. ooxml.md listed the OOXML traps (shared strings, shared
   formulas, calcChain, style-only cells) before the first line of code, and
   each one became a test.

5. Hooks. Four command hooks (no credits consumed): vocabulary-guard on edits
   under packages/ui, merge-properties on edits under packages/diff and
   packages/merge, fidelity-check on edits under packages/ooxml-patch, and
   canonical-fresh after a spec task. Because a file trigger only sees the
   agent's own edits, every hook is mirrored in CI — which is what caught a
   package name leaking into an import line and a UI string containing a Git
   word.

6. Property-based testing found what unit tests could not. Twelve properties
   (SUT-P-01 to SUT-P-12), 80 to 300 draws each. Eleven counterexamples are
   documented in packages/*/PROPERTIES.md, each one frozen as a deterministic
   regression test. Two examples: the row signature included the cell address,
   so inserting a row changed every signature below it and an insertion was
   reported as a deletion plus an insertion; and "shares at least half its
   cells" was implemented by value instead of by position, so a row where three
   amounts out of five had been retyped was split into a deletion and an
   insertion instead of being paired as modified.

7. MCP, powers, custom agents. Two custom agents with explicit permissions: a
   read-only reviewer (contracts, vocabulary, no-silent-loss, code shape) and a
   tester restricted to property files. One skill, suture-fixture, describing
   how to build a deterministic synthetic workbook — the fixture builder it
   documents produces byte-identical files from the same descriptor. No powers
   were needed.

8. What did not work. The merge queue stalled when the CI ran on a machine
   shared with a dozen other repositories: the queue's own verification
   exceeded the five-minute budget. Fixed by splitting the CI into two parallel
   jobs (types/lint/tests, and build) and by moving the pull-request checks to
   dedicated workers. hashFiles() failed on a self-hosted runner, so the guards
   now test for the file in the shell. isomorphic-git expects a global Buffer
   and a minimal process in the browser: without the polyfill the bundle loads
   and then dies on the first Git call — only an end-to-end run in a real
   browser revealed it. And useSyncExternalStore demands a stable snapshot:
   rebuilding the store object on every read produced an infinite render loop
   (React error #185) that no unit test could see.
```

### Bonus checkboxes

- [ ] **Blog post** — published during the submission window, on a third-party
      platform, stating it was written for Kiroween 2026. Draft in section 2.
- [ ] **Social post** — must **start** with `#KiroweenHackathon26`, say what you
      like most in Kiro and how it changed the way you develop. Draft in
      section 3.
- [ ] **Ghost of Kiroween Past** — only if you were registered in 2025.
- [ ] **Best Kiro Crew App** — not applicable to this project (this bonus
      targets project A in the brief).
- **Best Demo** — there is no checkbox to tick: the prize is awarded
      automatically to the best Presentation score among the top 10 % of
      projects. Nothing to fill in here — it is won through the video and the
      live demo.

---

## 2. Blog post draft (to publish on a third-party platform)

Title: **It was Git all along: building Suture for Kiroween 2026**

```
Every treasurer I know has a folder that looks like this: budget_2026.xlsx,
budget_2026_paul.xlsx, budget_2026_v2_marie_FINAL.xlsx, and a
budget_v7_final_FINAL(2).xlsx nobody dares delete. On Monday she sends one
file. On Thursday she gets two back. Reconciling them takes an hour, and nobody
can promise that nothing was lost.

Developers solved this problem twenty years ago. The solution is useless to
her, for two reasons: an .xlsx file is a compressed archive, so any diff sees
noise; and the vocabulary is a closed shop.

Suture is my entry for Kiroween 2026, in the Frankenstein category: real Git
plumbing, stitched to Excel archives, with a three-way merge at cell level and
a vocabulary borrowed from the office instead of the terminal. It runs entirely
in the browser. Nothing is uploaded, because the whole point is that the file
never leaves her machine.

The design decision I would defend hardest is the "carrier" principle. Suture
never rebuilds a workbook. It picks one side's file and patches only the cells
that came from the other side. Everything else — charts, conditional formats,
macros, the weird custom number format someone added in 2019 — is copied byte
for byte. That is why the combined file opens in Excel without a repair prompt,
which is the one thing that would have killed the project: a single "we found a
problem with some content" dialog and nobody trusts you again.

The second decision is a guarantee, not a feature: nothing is lost silently.
Every change from either side ends up in exactly one of three places — applied,
decided by the user, or listed in the report. When both sides changed the
structure of the same sheet differently, Suture refuses to guess. It asks which
side to keep, and lists the other side's changes so a human can apply them. An
honest report beats a clever merge.

I built it with Kiro, spec by spec: eight of them, in dependency order. The
most useful artefact was not the design documents, it was the acceptance
criteria — because each one became a property test. Twelve properties, run with
fast-check, found eleven bugs that my hand-written tests had missed. My
favourite: the row signature included the cell address, so inserting a row
changed the signature of every row below it, and a simple insertion was
reported as a deletion plus an insertion. No unit test I wrote could have
caught that; a randomly generated workbook did, on the first run.

I also ran an experiment. The A1-to-R1C1 formula conversion — the piece that
makes a carried formula land on the right row — was written twice: once against
the spec's acceptance criteria, once from the prose of my own brief. Both
versions were thrown at the same generated corpus. The spec-driven one: zero
counterexamples. The prose-only one: 187 out of 400. It rewrote sheet names,
table references and external workbooks. The lesson is not "specs are good".
It is that the value of a spec is the list of cases it forces you to enumerate
before you start typing.

Suture is live at https://tradoooo.github.io/suture/ and the source is at
https://github.com/BaptisteFaisy/suture (MIT). Click "Load the demo workbook":
you get the treasurer's Thursday afternoon, and you can reconcile it in about
two minutes.

Written for Kiroween 2026.
```

---

## 3. Social post draft

```
#KiroweenHackathon26 What I like most in Kiro is unglamorous: the acceptance
criteria. I used to write specs to think; now I write them because each one
becomes a test that runs on every save.

Proof from my Kiroween project (Suture — version control for spreadsheets,
without the word Git): I wrote the A1↔R1C1 formula conversion twice. Once
against the spec's criteria, once from the prose of my own brief. Same
generated corpus, 400 draws: 0 counterexamples with the spec, 187 without. The
spec's value was never the algorithm — it was the list of cases it forced me to
name before typing.

It changed how I work in one concrete way: I no longer start with code, I start
with the sentence "WHEN this happens, the system SHALL…", and I let the property
tests argue with me afterwards. Eleven bugs found that way, including one no
hand-written test would ever have caught.

Live demo (nothing leaves your browser): https://tradoooo.github.io/suture/
```

---

## 4. Ce qui reste vraiment (rappel)

- [ ] Tourner et publier la vidéo (< 3 min) — script : `docs/VIDEO-SCRIPT.md`.
- [ ] Ouvrir le fichier réuni dans **Excel** (pas seulement LibreOffice) et le
      confirmer dans la recette.
- [ ] Demander les **4 000 crédits Kiro** (avant le 1er décembre, 12 h
      Pacifique ; selfie + pièce d'identité, traitement sous 48 h ouvrées).
- [ ] Publier le billet de blog (plateforme tierce) et la publication sociale.
- [ ] Remplir le formulaire Devpost avec les textes ci-dessus, et soumettre
      avant le **4 décembre 2026, 14 h Pacifique** (23 h à Paris).
- [ ] Garder l'hébergement vivant jusqu'au **29 janvier 2027**.
