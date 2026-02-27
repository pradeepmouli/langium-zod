---
"langium-zod": minor
---

Add `langium-zod generate` CLI command

Consumers can now run `langium-zod generate` instead of maintaining a custom
`generate-zod.ts` script. The CLI reads `langium-config.json` to locate the
grammar file and optionally loads a `langium-zod.config.js` (or `.mjs`) for
`regexOverrides`, `outputPath`, `include`, and `exclude` options.

Usage:
```sh
langium-zod generate [--config langium-config.json] [--out src/generated/zod-schemas.ts]
```

Example `langium-zod.config.js`:
```js
export default {
  outputPath: 'src/generated/zod-schemas.ts',
  regexOverrides: {
    BigDecimal: String.raw`^[+-]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][+-]?[0-9]+)?$`,
  },
};
```

Also exports `LangiumZodConfig` and `GenerateOptions` types and the `generate()`
function from the package root for programmatic use.
