<!-- SYNC IMPACT REPORT
Version change: 1.0.0 -> 2.0.0
Modified principles: V. Package Modularity (enforcement scope updated)
Added sections: N/A
Removed sections: N/A
Templates requiring updates:
  OK .specify/templates/plan-template.md -- Constitution Check gate remains compatible
  OK .specify/templates/spec-template.md -- No structural impact
  OK .specify/templates/tasks-template.md -- No structural impact
  OK .github/prompts/* -- Constitution path unchanged
Follow-up TODOs: Ensure active plans/tasks align with updated Principle V interpretation
-->

# langium-zod Constitution

## Core Principles

### I. Grammar-Driven Schema Derivation (NON-NEGOTIABLE)

All Zod schemas exposed by this library MUST be derived mechanically from Langium grammar
definitions. Hand-authored schemas that duplicate or shadow grammar-defined structure are
prohibited. Derivation logic MUST live entirely in the generator layer; no schema rule may
be injected at schema-creation call sites outside the generator.

**Rationale**: The value proposition of langium-zod is a single source of truth - the
grammar. Manually duplicating grammar structure in schema code creates drift, defeats the
generator's purpose, and silently breaks consumers when grammars evolve.

### II. AST Type Compatibility

Every generated Zod schema MUST produce an inferred TypeScript type that is structurally
compatible with the corresponding Langium-generated AST interface (typically found in
`language/generated/ast.ts`). "Structurally compatible" means the schema's inferred type
MUST be assignable to the AST type without casting or type assertions.

**Rationale**: Consumers rely on both the AST type for static analysis and the Zod schema
for runtime validation. If the two diverge the library is unsafe, misleading consumers
about correctness while compiling successfully.

### III. Test-First (NON-NEGOTIABLE)

TDD is mandatory across all workspace packages. The cycle is strictly enforced:

1. Tests written and reviewed.
2. Tests confirmed to fail (red).
3. Implementation written to pass tests (green).
4. Refactor with tests continuously passing.

Unit tests MUST cover all public schema-generation functions. Integration tests MUST cover
at least one full grammar-to-schema round trip per supported Langium major version. Test
files MAY NOT be committed without a corresponding failing state first captured in the PR.

**Rationale**: Schema generation involves complex structural transformations. Regressions
are silent - a wrong schema compiles but silently accepts invalid AST input. TDD is the
primary and non-negotiable defence.

### IV. Langium Version Compatibility Contract

The library MUST declare explicit `peerDependencies` for every Langium major version it
supports. Each supported major Langium release MUST have a corresponding integration test
suite. Dropping support for a Langium major version requires a semver MAJOR bump and a
published migration guide in `docs/` before the change is merged.

**Rationale**: Langium's AST shape changes across major releases. Consumers target a
specific Langium version; the library MUST be honest and explicit about which versions it
validates correctly to avoid silent schema mismatches in production language tools.

### V. Package Modularity

Each distinct concern - grammar traversal, Zod schema generation, and Langium
CLI/generator plugin integration - MUST have explicit modular boundaries.
In a monorepo, these boundaries MAY be implemented either as separate pnpm workspace
packages or as clearly separated modules within a single package.
Architectures MUST NOT introduce circular dependencies across concern boundaries.
Public APIs MUST be declared explicitly via `package.json` `exports` fields.
Internal utilities MUST NOT be re-exported from a package's public entry point.

**Rationale**: The core requirement is clean separation of concerns and stable public
contracts. Some repositories require separate installable packages, while others can
preserve equivalent modularity within one package. Enforcing architectural boundaries
without over-prescribing packaging minimizes churn while protecting maintainability.

## Technology Stack

- **Language**: TypeScript >= 5.4 with strict mode (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes` enabled).
- **Runtime validation**: Zod >= 3.22 (declared as `peerDependency`).
- **Grammar framework**: Langium >= 3.0 (declared as `peerDependency`; multiple major
  versions supported via `peerDependencies` range).
- **Package manager**: pnpm >= 10 with workspaces (`pnpm-workspace.yaml`).
- **Test runner**: Vitest; coverage via `@vitest/coverage-v8`.
- **Linting / formatting**: oxlint + oxfmt; zero lint errors MUST be maintained on every
  commit.
- **Versioning**: Changesets (`@changesets/cli`); conventional commit messages required.
- **Node.js**: >= 20.
- **Module format**: ESM-only (`"type": "module"`); no CJS output from library packages.
- **Bundlers**: Prohibited in library packages; consumers bundle their own output.

## Development Workflow

1. All changes MUST start from a feature branch named `###-short-description`.
2. A spec (`spec.md`) MUST exist for any change that modifies a public API or adds a
   workspace package.
3. The Constitution Check gate in `plan-template.md` MUST be passed before Phase 0
   research begins and re-verified after Phase 1 design.
4. PRs MUST pass: `pnpm run lint`, `pnpm test`, and `pnpm run type-check`.
5. A changeset MUST be included for any change that affects a published package version.
6. Changes introducing a semver MAJOR bump MUST include a migration guide in `docs/`
   before the PR is merged.
7. Generated code (e.g., `language/generated/`) MUST NOT be edited by hand; regenerate
   via `pnpm run langium:generate` or equivalent.
8. All PRs MUST include a Constitution Check section confirming compliance with Principles
   I-V. Non-compliance blocks merge unless an explicit exception is documented in the PR
   and the plan's Complexity Tracking section.

## Governance

This constitution supersedes all other documented practices. Amendments follow semantic
versioning:

- **MAJOR** - Removal of a principle, redefinition that fundamentally changes enforcement
  scope, or removal of a supported-version policy.
- **MINOR** - Addition of a new principle or section, or material expansion of existing
  guidance that adds new obligations.
- **PATCH** - Clarifications, wording refinements, typographical corrections, or
  non-semantic reordering.

All amendments MUST be submitted as PRs containing: (a) a summary of what changed and
why, (b) an updated `CONSTITUTION_VERSION` in this file, (c) an updated
`LAST_AMENDED_DATE`, and (d) this Sync Impact Report updated to reflect the amendment.

Use `AGENTS.md` for runtime multi-agent workflow guidance and `docs/DEVELOPMENT.md` for
day-to-day development process details.

**Version**: 2.0.0 | **Ratified**: 2026-02-19 | **Last Amended**: 2026-02-27
