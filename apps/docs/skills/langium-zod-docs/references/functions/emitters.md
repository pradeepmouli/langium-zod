# Functions

## emitters

### `generateNamespaceOps`
No import-alias suffix is used. The generated `domain.ts` is a single barrel:

  import * as ast from './ast.js';
  export * from './ast.js';              // forwards every guard / reflection / non-namespaced type
  export type Data = ast.Data;           // local type alias — shadows the star-exported interface
  export namespace Data { ... }          // local value — shadows the star-exported reflection const

A local `type` + `namespace` pair under the same name merges (type space + value space)
and, per TypeScript export precedence, shadows the corresponding names brought in by
`export * from './ast.js'`. So function signatures reference bare `Data` / `Attribute`,
which resolve to the local alias (namespaced types) or the star-exported interface
(non-namespaced element types) — no `$`-suffixed aliases, no TS2395.
```ts
generateNamespaceOps(types: ZodTypeDescriptor[], options?: NamespaceOpsOptions): string
```
**Parameters:**
- `types: ZodTypeDescriptor[]`
- `options: NamespaceOpsOptions` (optional)
**Returns:** `string`

### `generateDomainCode`
```ts
generateDomainCode(descriptors: ZodTypeDescriptor[], options: DomainGenerationOptions): string
```
**Parameters:**
- `descriptors: ZodTypeDescriptor[]`
- `options: DomainGenerationOptions` — default: `{}`
**Returns:** `string`
