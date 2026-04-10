# Variables & Constants

## config

### `DEFAULT_OUTPUT_PATH`
Default output path used when no explicit `outputPath` is provided and the
project's `langium-config.json` does not declare an `out` directory.
```ts
const DEFAULT_OUTPUT_PATH: "src/generated/zod-schemas.ts"
```

## di

### `ZodSchemaGeneratorModule`
Langium `Module` definition that registers DefaultZodSchemaGenerator
under `shared.ZodSchemaGenerator` in the Langium DI container.

Pass this module to `inject()` alongside your language's own module to make the
Zod schema generator available as a shared service:

```ts
const services = inject(createLangiumGrammarServices(NodeFileSystem), ZodSchemaGeneratorModule);
const source = services.shared.ZodSchemaGenerator.generate(grammar);
```
```ts
const ZodSchemaGeneratorModule: Module<ZodSchemaGeneratorServices, Partial<ZodSchemaGeneratorServices>>
```
