# Functions

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
