# langium-zod Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-20

## Active Technologies

- TypeScript 5.x (ESM modules) + `langium` 4.x (grammar/type system), `zod` 4.x (generated output target), `x-to-zod` (user's library for Zod code generation) (001-langium-zod-plugin)

## Project Structure

This is a pnpm monorepo. The Langium Zod plugin lives at:

```text
packages/langium-zod/
  src/       # source files
  test/      # test files
```

## Commands

Run from the repo root using pnpm:

```sh
pnpm test          # run all tests
pnpm run lint      # lint all packages
pnpm run format    # format all files
```

Or from within `packages/langium-zod/`:

```sh
npm test           # run tests for this package only
```

## Code Style

TypeScript 5.x (ESM modules): Follow standard conventions

## Recent Changes

- 001-langium-zod-plugin: Added TypeScript 5.x (ESM modules) + `langium` 4.x (grammar/type system), `zod` 4.x (generated output target), `x-to-zod` (user's library for Zod code generation)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
