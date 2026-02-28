# langium-zod

Generate Zod schemas from Langium grammars.

## Install

```bash
pnpm add langium-zod
```

## Usage

```ts
import { generateZodSchemas } from 'langium-zod';

const source = generateZodSchemas({ grammar, services });
```

### Programmatic options

```ts
generateZodSchemas({
	grammar,
	outputPath: 'src/generated/zod-schemas.ts',
	include: ['Greeting', 'Tag'],
	exclude: ['InternalNode'],
	stripInternals: true,
	projection: {
		defaults: { strip: ['$container', '$document'] },
		types: {
			Greeting: { fields: ['name', 'tags'] }
		}
	},
	conformance: {
		astTypesPath: 'src/generated/ast.ts'
	},
	crossRefValidation: true
});
```

### CLI options

```sh
langium-zod generate \
	--config langium-config.json \
	--out src/generated/zod-schemas.ts \
	--include Greeting,Tag \
	--exclude InternalNode \
	--projection projection.json \
	--strip-internals \
	--conformance \
	--ast-types src/generated/ast.ts \
	--conformance-out src/generated/zod-schemas.conformance.ts \
	--cross-ref-validation
```

`zRef` is exported from the package for manual schema customization in runtime-aware validation flows.

Generated output uses Zod 4 and exports named schemas like `<TypeName>Schema`.

## Requirements

- Node.js >= 20
- Langium 4.x
- Zod 4.x
