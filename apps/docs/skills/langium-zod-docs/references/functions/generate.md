# Functions

## generate

### `generate`
Programmatic entry point for the `langium-zod generate` command.

Loads `langium-config.json` from `opts.langiumConfigPath`, resolves the grammar
file path, parses the grammar with Langium services (including eager import
loading so cross-file references link correctly), then calls
generateZodSchemas with the merged configuration. Prints a success
message to stdout when generation completes.
```ts
generate(opts: GenerateOptions): Promise<void>
```
**Parameters:**
- `opts: GenerateOptions` — GenerateOptions specifying the langium config path and
  optional pre-merged generator config.
**Returns:** `Promise<void>`
**Throws:** `Error` when the langium-config.json or grammar file cannot be found, or
  when the config defines no languages.
```ts
import { generate } from 'langium-zod';
import { resolve } from 'node:path';

await generate({
  langiumConfigPath: resolve(process.cwd(), 'langium-config.json'),
  config: {
    outputPath: 'src/generated/zod-schemas.ts',
    stripInternals: true,
  },
});
// Prints: ✓ Generated Zod schemas → src/generated/zod-schemas.ts
```
