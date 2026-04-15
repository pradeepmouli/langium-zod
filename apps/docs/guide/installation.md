# Installation

## Prerequisites

- Node.js >= 20
- A Langium-based project with a grammar you want to derive Zod schemas from

## Install the package

```bash
pnpm add langium-zod
```

Or with npm / yarn:

```bash
npm install langium-zod
yarn add langium-zod
```

## Verify

```ts
import { generateZodSchemas } from 'langium-zod';
console.log(typeof generateZodSchemas); // 'function'
```

See [Usage](./usage.md) for the end-to-end workflow.
