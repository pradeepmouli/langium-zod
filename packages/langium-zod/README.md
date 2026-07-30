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

## Domain target (experimental)

Besides Zod schemas, langium-zod can emit a **domain surface** — quirk-free read
interfaces, a `toDomain(node)` read projection, and field-precise write accessors:

    langium-zod generate --domain --domain-out src/generated/domain.ts

Mechanical rules are generic (a single cross-reference flattens to a `$refText`
string). Project-specific renames and read-only merges are supplied via
`domainOverlays` in `langium-zod.config.js`:

    export default {
      domainOverlays: {
        types: {
          Choice: { renames: { attributes: 'options' } },
          RosettaFunction: { merges: [{ from: ['conditions', 'postConditions'], to: 'conditions' }] }
        }
      }
    };

Merges are read-only on the merged name; write accessors target the source
fields (`addConditions`, `addPostConditions`) — there is no merged setter.

