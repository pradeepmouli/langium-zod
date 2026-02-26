# @pradeepmouli/langium-zod

Generate Zod schemas from Langium grammars.

## Install

```bash
pnpm add @pradeepmouli/langium-zod
```

## Usage

```ts
import { generateZodSchemas } from '@pradeepmouli/langium-zod';

const source = generateZodSchemas({ grammar, services });
```

Generated output uses Zod 4 and exports named schemas like `<TypeName>Schema`.

## Requirements

- Node.js >= 20
- Langium 4.x
- Zod 4.x
