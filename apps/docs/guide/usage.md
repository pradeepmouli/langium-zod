# Usage

## Programmatic generation

```ts
import { generateZodSchemas } from 'langium-zod';

const zodSource = generateZodSchemas({ grammar, services });
```

## CLI-style generation

```ts
import { generate } from 'langium-zod';

await generate({
  grammar: 'src/language/my-dsl.langium',
  output: 'src/generated/schemas.ts',
});
```

## How it works

The extractor walks Langium's inferred `AstTypes` to build a parser-neutral descriptor tree, the recursion detector marks cycles, and the code generator prints Zod v4 schemas (using `z.lazy` where needed and `zRef` for cross-references). A Langium DI module is provided so the generator can be registered as a service on a custom language.

## API reference

See the full [API reference](../api/) for every exported symbol, including:

- `generateZodSchemas`
- `extractTypeDescriptors`
- `generateZodCode`
- `detectRecursiveTypes`
- `zRef`
- `DefaultZodSchemaGenerator` / `ZodSchemaGeneratorModule`
- `FilterConfig` / `ZodGeneratorConfig`
- `ZodGeneratorError`
