# Quickstart: Rune DSL schema generation enhancements

**Date**: 2026-02-27
**Feature**: 002-rune-dsl-enhancements

## Prerequisites

- Node.js >= 20
- pnpm installed
- Workspace dependencies installed via `pnpm install`

## 1) Run targeted tests first (TDD workflow)

```bash
pnpm --filter langium-zod test -- --run test/unit/type-mapper.test.ts
pnpm --filter langium-zod test -- --run test/integration/generation.test.ts
pnpm --filter langium-zod test -- --run test/integration/langium-cli.external.test.ts
```

## 2) Validate cardinality fix (`+` => `.min(1)`)

Run generation against a fixture containing both `+=Rule+` and `+=Rule*`, then confirm output:
- one-or-more arrays include `.min(1)`
- zero-or-more arrays do not include `.min(1)`

## 3) Validate CLI include/exclude behavior

```bash
pnpm --filter langium-zod test -- --run test/integration/langium-cli.external.test.ts
```

Expected:
- `--include A,B` emits only `ASchema` and `BSchema`
- `--exclude X` omits `XSchema`
- overlap uses include then exclude (excluded)
- unknown names warn, generation continues

## 4) Validate projection and strip-internals

Example command pattern:

```bash
node packages/langium-zod/dist/cli.js generate \
  --grammar packages/langium-zod/test/fixtures/hierarchy.langium \
  --projection path/to/projection.json \
  --strip-internals
```

Expected:
- five internal fields removed when strip enabled
- per-type allowlists applied
- unknown projection field names warn and skip
- unreadable/invalid projection file exits with clear error and no output changes

## 5) Validate conformance artifact generation

```bash
node packages/langium-zod/dist/cli.js generate \
  --grammar packages/langium-zod/test/fixtures/hierarchy.langium \
  --conformance
```

Expected:
- AST path auto-resolves from `langium-config.json` if `--ast-types` omitted
- conformance file emitted next to schema output (or at `--conformance-out`)
- if AST path cannot be resolved, command fails fast with clear error

## 6) Validate cross-reference runtime factories

```bash
node packages/langium-zod/dist/cli.js generate \
  --grammar packages/langium-zod/test/fixtures/crossref.langium \
  --cross-ref-validation
```

Expected:
- unchanged output when flag is absent
- with flag, types containing retained cross-ref fields emit `create*Schema(refs)` and `*SchemaRefs`
- factories accept known refs, reject unknown refs, allow empty/undefined optional refs
- `zRef()` remains importable from package entrypoint regardless of flags

## 7) Full verification

```bash
pnpm run lint
pnpm test
pnpm run type-check
```
