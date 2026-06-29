# Functions

## api

### `generateDomainSchemas`
Programmatic entry point for the domain target. Runs the same extract pipeline
as generateZodSchemas, then emits the domain surface (read interfaces +
`toDomain` projection + field-precise write accessors). Writes to
`config.domainOutputPath` when set.
```ts
generateDomainSchemas(config: ZodGeneratorConfig): string
```
**Parameters:**
- `config: ZodGeneratorConfig`
**Returns:** `string`
