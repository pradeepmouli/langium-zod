# Functions

## `generateZodSchemas`
```ts
generateZodSchemas(config: ZodGeneratorConfig): string
```
**Parameters:**
- `config: ZodGeneratorConfig` — 
**Returns:** `string`

## `extractTypeDescriptors`
```ts
extractTypeDescriptors(astTypes: AstTypesLike, config?: FilterConfig): ZodTypeDescriptor[]
```
**Parameters:**
- `astTypes: AstTypesLike` — 
- `config: FilterConfig` (optional) — 
**Returns:** `ZodTypeDescriptor[]`

## `generateZodCode`
```ts
generateZodCode(descriptors: ZodTypeDescriptor[], recursiveTypes: Set<string>, options: GenerationOptions): string
```
**Parameters:**
- `descriptors: ZodTypeDescriptor[]` — 
- `recursiveTypes: Set<string>` — 
- `options: GenerationOptions` — default: `{}` — 
**Returns:** `string`

## `detectRecursiveTypes`
```ts
detectRecursiveTypes(descriptors: ZodTypeDescriptor[]): Set<string>
```
**Parameters:**
- `descriptors: ZodTypeDescriptor[]` — 
**Returns:** `Set<string>`

## `zRef`
```ts
zRef(collection: string[] | (() => string[]), message: string): ZodString
```
**Parameters:**
- `collection: string[] | (() => string[])` — 
- `message: string` — default: `'Unknown reference value'` — 
**Returns:** `ZodString`

## `resolveFilterOverrides`
```ts
resolveFilterOverrides(base: Pick<LangiumZodConfig, "include" | "exclude">, includeArg?: string, excludeArg?: string): Pick<LangiumZodConfig, "include" | "exclude">
```
**Parameters:**
- `base: Pick<LangiumZodConfig, "include" | "exclude">` — 
- `includeArg: string` (optional) — 
- `excludeArg: string` (optional) — 
**Returns:** `Pick<LangiumZodConfig, "include" | "exclude">`

## `getUnknownFilterNames`
```ts
getUnknownFilterNames(requested: string[] | undefined, availableTypeNames: string[]): string[]
```
**Parameters:**
- `requested: string[] | undefined` — 
- `availableTypeNames: string[]` — 
**Returns:** `string[]`

## `generate`
```ts
generate(opts: GenerateOptions): Promise<void>
```
**Parameters:**
- `opts: GenerateOptions` — 
**Returns:** `Promise<void>`

## `main`
```ts
main(): Promise<void>
```
**Returns:** `Promise<void>`
