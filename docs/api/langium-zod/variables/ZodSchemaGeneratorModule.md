[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / ZodSchemaGeneratorModule

# Variable: ZodSchemaGeneratorModule

> `const` **ZodSchemaGeneratorModule**: `Module`\<[`ZodSchemaGeneratorServices`](../type-aliases/ZodSchemaGeneratorServices.md), `Partial`\<[`ZodSchemaGeneratorServices`](../type-aliases/ZodSchemaGeneratorServices.md)\>\>

Defined in: [packages/langium-zod/src/di.ts:68](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/di.ts#L68)

Langium `Module` definition that registers [DefaultZodSchemaGenerator](../classes/DefaultZodSchemaGenerator.md)
under `shared.ZodSchemaGenerator` in the Langium DI container.

Pass this module to `inject()` alongside your language's own module to make the
Zod schema generator available as a shared service:

```ts
const services = inject(createLangiumGrammarServices(NodeFileSystem), ZodSchemaGeneratorModule);
const source = services.shared.ZodSchemaGenerator.generate(grammar);
```
