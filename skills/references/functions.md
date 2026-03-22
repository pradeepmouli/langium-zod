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
