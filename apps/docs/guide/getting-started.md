# Getting Started

> **⚠️ Pre-1.0 software** — APIs are subject to change between minor versions. Pin to exact versions in production.

`langium-zod` inspects the type system Langium infers from a grammar (interfaces, unions, primitive properties, cross-references) and emits a corresponding set of Zod schemas. The result is a single TypeScript module you can import anywhere you need to validate or parse AST-shaped data at runtime — tooling, import pipelines, language servers, or network boundaries that consume your DSL.

## Install

```bash
pnpm add langium-zod
```

## Quick start

```ts
import { generateZodSchemas } from 'langium-zod';

const zodSource = generateZodSchemas({ grammar, services });
```

## Next steps

- [Installation](./installation.md)
- [Usage](./usage.md)
- [API Reference](../api/)
