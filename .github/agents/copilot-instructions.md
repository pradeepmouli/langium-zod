# langium-zod Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-27

## Active Technologies

- TypeScript 5.x (ESM, strict mode) + `langium` 4.x, `zod` 4.x (generated target), existing `commander`-style CLI in package, Node `fs/path` for config loading (002-rune-dsl-enhancements)

## Project Structure

```text
src/
tests/
```

## Commands

pnpm test && pnpm run lint

## Code Style

TypeScript 5.x (ESM, strict mode): Follow standard conventions

## Recent Changes

- 002-rune-dsl-enhancements: Added TypeScript 5.x (ESM, strict mode) + `langium` 4.x, `zod` 4.x (generated target), existing `commander`-style CLI in package, Node `fs/path` for config loading

<!-- MANUAL ADDITIONS START -->
- Testing execution preference: run tests via terminal (`pnpm test`) in this workspace. IDE/workspace test runner invocations may hang intermittently.
<!-- MANUAL ADDITIONS END -->
