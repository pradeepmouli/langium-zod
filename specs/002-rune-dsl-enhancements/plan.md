# Implementation Plan: Rune DSL schema generation enhancements

**Branch**: `002-rune-dsl-enhancements` | **Date**: 2026-02-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-rune-dsl-enhancements/spec.md`

## Summary

Implement five independent enhancements in `packages/langium-zod` to support Rune DSL integration: (1) enforce `+` cardinality as array minimum length, (2) expose CLI include/exclude filters, (3) add projection/form-surface mode with internal stripping, (4) generate optional conformance artifacts aligned with `ast.ts`, and (5) add optional runtime cross-reference validation factories plus reusable `zRef`. The approach extends the existing extraction → descriptor mapping → code generation pipeline with minimal API additions and backward-compatible defaults.

## Technical Context

**Language/Version**: TypeScript 5.x (ESM, strict mode)
**Primary Dependencies**: `langium` 4.x, `zod` 4.x (generated target), existing `commander`-style CLI in package, Node `fs/path` for config loading
**Storage**: File-system based code generation artifacts (`zod-schemas.ts`, optional `*.conformance.ts`)
**Testing**: Vitest unit + integration tests in `packages/langium-zod/test`
**Target Platform**: Node.js >= 20 on macOS/Linux/CI runners
**Project Type**: pnpm monorepo package enhancement (single package scope)
**Performance Goals**: Preserve current generation performance envelope; no material slowdown for grammars up to ~100 types
**Constraints**: Backward compatible by default; new behavior gated by explicit CLI/config flags except cardinality correctness fix
**Scale/Scope**: Changes limited to `packages/langium-zod/src/*`, tests, and package docs/contracts for feature 002

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gate Assessment

- **I. Grammar-Driven Schema Derivation**: PASS — all enhancements operate on generated schema derivation logic and keep grammar as source of truth.
- **II. AST Type Compatibility**: PASS — conformance artifact explicitly strengthens compatibility checks.
- **III. Test-First**: PASS (planned) — implementation tasks will add/adjust failing tests first for each enhancement area.
- **IV. Langium Version Compatibility Contract**: PASS — no supported Langium major change proposed; existing integration patterns retained.
- **V. Package Modularity**: PASS — design keeps modular concern boundaries via separated modules inside `packages/langium-zod`.

### Post-Design Gate Re-Check

- **I**: PASS — design keeps transformations in extractor/type-mapper/generator layers.
- **II**: PASS — conformance output and strip/projection interplay explicitly modeled.
- **III**: PASS (by plan) — unit/integration test deltas defined in quickstart and contracts.
- **IV**: PASS — no peerDependency range or support policy changes.
- **V**: PASS — concern boundaries remain explicit and acyclic within a single package.

## Project Structure

### Documentation (this feature)

```text
specs/002-rune-dsl-enhancements/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── generator-enhancements.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/langium-zod/
├── src/
│   ├── api.ts
│   ├── cli.ts
│   ├── extractor.ts
│   ├── generator.ts
│   ├── type-mapper.ts
│   ├── types.ts
│   ├── index.ts
│   ├── projection.ts          # new
│   ├── conformance.ts         # new
│   └── ref-utils.ts           # new
└── test/
    ├── unit/
    │   ├── extractor.test.ts
    │   ├── type-mapper.test.ts
    │   └── recursion-detector.test.ts
    └── integration/
        ├── generation.test.ts
        ├── di.test.ts
        └── langium-cli.external.test.ts
```

**Structure Decision**: Keep a single-package enhancement model in `packages/langium-zod`; maintain explicit module-level concern boundaries (`extractor.ts`, `generator.ts`, `cli.ts`, etc.) without introducing package-split churn for Feature 002.

## Complexity Tracking

No constitution violations identified; no complexity exemptions required.
