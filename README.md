# langium-zod

> Zod v4 schema generation from Langium grammars — integrate Langium DSLs with TypeScript validation pipelines.

> **⚠️ Pre-1.0 software** — APIs are subject to change between minor versions. Pin to exact versions in production. See the [CHANGELOG](./CHANGELOG.md) for breaking changes between releases.

<p align="center">
  <a href="https://www.npmjs.com/package/langium-zod"><img src="https://img.shields.io/npm/v/langium-zod?style=flat-square&label=langium-zod" alt="npm version" /></a>
  <a href="https://github.com/pradeepmouli/langium-zod/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/pradeepmouli/langium-zod/ci.yml?style=flat-square" alt="ci" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="license" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square" alt="node" />
</p>

📚 **Documentation:** <https://pradeepmouli.github.io/langium-zod/>

## Overview

`langium-zod` inspects the type system Langium infers from a grammar (interfaces, unions, primitive properties, cross-references) and emits a corresponding set of Zod schemas. The result is a single TypeScript module you can import anywhere you need to validate or parse AST-shaped data at runtime — tooling, import pipelines, language servers, or network boundaries that consume your DSL.

## Install

```bash
pnpm add langium-zod
```

## Quick Start

Programmatic use:

```ts
import { generateZodSchemas } from 'langium-zod';

const zodSource = generateZodSchemas({ grammar, services });
```

CLI use (via the `generate` entry point or the project's own CLI wiring):

```ts
import { generate } from 'langium-zod';

await generate({
  grammar: 'src/language/my-dsl.langium',
  output: 'src/generated/schemas.ts',
});
```

## Features

- `generateZodSchemas` — end-to-end API that takes a Langium grammar plus services and returns Zod source
- `extractTypeDescriptors` — walk a Langium `AstTypes` shape into neutral `ZodTypeDescriptor` / `ZodPropertyDescriptor` records
- `generateZodCode` — render descriptors to Zod v4 TypeScript source
- `detectRecursiveTypes` — identify cycles so the generator can emit `z.lazy(...)` where required
- `zRef` — runtime helper for modelling Langium cross-references in generated schemas
- `DefaultZodSchemaGenerator` + `ZodSchemaGeneratorModule` — Langium DI module so the generator can be injected into a language's services
- Configurable output path (`DEFAULT_OUTPUT_PATH`) and filtering (`FilterConfig`, `ZodGeneratorConfig`)
- Structured errors via `ZodGeneratorError`

## How it works

The extractor walks Langium's inferred `AstTypes` to build a parser-neutral descriptor tree, the recursion detector marks cycles, and the code generator prints Zod v4 schemas (using `z.lazy` where needed and `zRef` for cross-references). A Langium DI module is provided so the generator can be registered as a service on a custom language.

## Development

```bash
pnpm install
pnpm run build
pnpm run test
pnpm run lint
pnpm run type-check
```

Release workflow uses Changesets:

```bash
pnpm changeset
pnpm changeset:version
pnpm changeset:publish
```

Automated release is configured in `.github/workflows/release.yml`.

## Documentation

- Full docs site: <https://pradeepmouli.github.io/langium-zod/>
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CHANGELOG.md](./CHANGELOG.md)

## Related Projects

| Library | Relationship | npm |
|---|---|---|
| [x-to-zod](https://github.com/pradeepmouli/x-to-zod) | JSON Schema → Zod conversion (used internally for schema bridging) | [![npm](https://img.shields.io/npm/v/x-to-zod?style=flat-square)](https://www.npmjs.com/package/x-to-zod) |
| [rune-langium](https://github.com/pradeepmouli/rune-langium) | DSL toolchain that uses langium-zod for schema generation | [![npm](https://img.shields.io/npm/v/@rune-langium/core?style=flat-square)](https://www.npmjs.com/package/@rune-langium/core) |
| [zod-to-form](https://github.com/pradeepmouli/zod-to-form) | Takes the Zod schemas langium-zod generates and produces React forms | [![npm](https://img.shields.io/npm/v/@zod-to-form/core?style=flat-square)](https://www.npmjs.com/package/@zod-to-form/core) |

## License

MIT — see [LICENSE](./LICENSE).
