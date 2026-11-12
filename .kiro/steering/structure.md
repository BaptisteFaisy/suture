# Suture — Structure Steering

_Always included. File layout, naming conventions, imports._

## Layout

```
.
├── .github/
│   ├── couche0/           # anti-regression guard (inherited from vision)
│   ├── inferhub/         # conflict resolver agent (InferHub, combo/cheap)
│   ├── ci-budget/         # 5 min timeout enforcement
│   └── workflows/
│       ├── ci.yml         # typecheck, lint, test, build, guards (timeout 5m)
│       ├── ci-budget.yml
│       ├── couche0.yml
│       ├── pr-auto-merge.yml
│       ├── stale-base-guard.yml
│       └── triage-rouge.yml
├── .kiro/
│   ├── steering/          # product.md, tech.md, structure.md, testing.md, ...
│   ├── specs/             # ooxml-io, formula-r1c1, diff-engine, merge-engine, ...
│   ├── hooks/             # vocabulary-guard.json, merge-properties.json, ...
│   ├── agents/            # reviewer.md, tester.md
│   ├── skills/            # suture-fixture/SKILL.md
│   └── settings/mcp.json
├── packages/
│   ├── contracts/         # pure TS types, zero external deps
│   ├── formula/           # A1 ↔ R1C1, cell reference offset
│   ├── ooxml-io/          # zip/unzip, part discovery, limits
│   ├── canonical/         # derive cells/*.tsv and _workbook.json
│   ├── diff/              # row signature, LCS alignment, ChangeSet
│   ├── merge/             # 3-way combine, disagreement detection, report
│   ├── ooxml-patch/       # carrier patching, calcChain removal, origin marker
│   ├── git-store/         # isomorphic-git wrapper, versions, scenarios, export
│   └── ui/                # reusable UI components, theme, i18n
├── apps/
│   └── web/               # Vite + React app, entry point, demo loader
├── scripts/
│   ├── vocabulary-guard.mjs   # fails if banned Git words leak into UI
│   ├── check-line-limits.mjs  # fails if any file >= 500 lines or fn >= 50
│   └── generate-demo-fixtures.mjs
├── fixtures/              # synthetic xlsx files for tests & demo
├── KIRO_JOURNAL.md        # living log of Kiro usage for submission
├── LICENSE                # MIT
├── README.md              # English, judges entry point
└── package.json           # pnpm workspace root
```

## Naming rules

- Files: `kebab-case.ts`, `kebab-case.tsx`
- Types / Interfaces: `PascalCase`
- Functions / variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Test files: `<name>.test.ts`, property tests `<name>.prop.test.ts`
- Specs: `.kiro/specs/<spec-name>/requirements.md`, `design.md`, `tasks.md`

## Import conventions

- Packages import other packages via `@suture/<name>` (configured via pnpm
  workspace + tsconfig paths).
- No circular dependencies between packages.
- Dependency order (acyclic):
  `contracts`
    └── `formula`
    └── `ooxml-io`
    └── `canonical` (depends on `contracts`, `formula`, `ooxml-io`)
    └── `diff` (depends on `contracts`, `formula`)
    └── `merge` (depends on `contracts`, `diff`, `formula`)
    └── `ooxml-patch` (depends on `contracts`, `ooxml-io`, `formula`)
    └── `git-store` (depends on `contracts`, `canonical`, `ooxml-io`)
    └── `ui` (depends on all of the above)
    └── `apps/web` (depends on `ui`)
