# langium-zod

> Zod v4 schema generation from Langium grammars — integrate Langium DSLs with TypeScript validation pipelines.

> **⚠️ Pre-1.0 software** — APIs are subject to change between minor versions. Pin to exact versions in production. See the [CHANGELOG](./CHANGELOG.md) for breaking changes between releases.

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

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/EXAMPLES.md](docs/EXAMPLES.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT — see [LICENSE](./LICENSE).
