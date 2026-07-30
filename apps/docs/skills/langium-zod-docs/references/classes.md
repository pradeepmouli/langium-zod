# Classes

## Generation

### `ZodGeneratorError`
Custom error class thrown by the langium-zod code generator when it
encounters a condition it cannot recover from.

Carries optional structured context that pinpoints the source of the problem:
- `typeName` — the Langium interface or union type being processed when the
  error occurred.
- `grammarElement` — the specific grammar property or rule element that
  triggered the failure.
- `suggestion` — a human-readable hint explaining how to fix the issue,
  surfaced to the user in CLI output.

The `name` property is always set to `'ZodGeneratorError'` so that error
handlers can distinguish this class from generic `Error` instances without
needing an `instanceof` check across module boundaries.
*extends `Error`*
```ts
constructor(message: string, options?: ZodGeneratorErrorOptions): ZodGeneratorError
```
**Properties:**
- `grammarElement: string` (optional)
- `typeName: string` (optional)
- `suggestion: string` (optional)
```ts
import { generateZodSchemas, ZodGeneratorError } from 'langium-zod';

try {
  generateZodSchemas({ grammar: parsedGrammar });
} catch (err) {
  if (err instanceof ZodGeneratorError) {
    console.error(err.message);
    if (err.suggestion) console.error('Hint:', err.suggestion);
    if (err.typeName) console.error('Type:', err.typeName);
  } else {
    throw err;
  }
}
```

## DI

### `DefaultZodSchemaGenerator`
Default implementation of ZodSchemaGenerator.

Wraps the top-level generateZodSchemas function and injects the
`LangiumCoreServices` instance provided by the DI container, so callers do not
need to pass services manually on every invocation.
*implements `ZodSchemaGenerator`*
```ts
constructor(services: LangiumCoreServices): DefaultZodSchemaGenerator
```
**Methods:**
- `generate(grammar: Grammar, config?: Partial<ZodGeneratorConfig>): string` — Generates Zod schemas for the given grammar and returns the TypeScript source string.
