/**
 * @packageDocumentation
 *
 * @remarks
 * **langium-zod** — generate Zod validation schemas from Langium grammar definitions.
 *
 * Before generating, ask:
 * - **Recursive rules?** Grammar rules that reference themselves (e.g. `Expression: ... | left=Expression`) require cycle detection. `generateZodSchemas` handles this automatically via {@link detectRecursiveTypes}, but if you build a custom pipeline you must run detection on the *full* descriptor set before any projection.
 * - **Cross-references?** Langium `ref:` properties become `ReferenceSchema` by default. Enable `crossRefValidation: true` only when you have a live document model to validate against at runtime; otherwise every cross-ref property will emit an unconstrained `ReferenceSchema`.
 * - **Discriminated unions?** Every Langium union type (e.g. `Expression = Literal | BinaryExpr`) maps to a Zod discriminated union keyed on `$type`. All member types must be emitted — use `include` with care when union types are involved.
 * - **Grammar changes?** Generated schemas are compile-time artifacts. Any grammar edit (new rule, renamed property, changed cardinality) requires regeneration. Wire `langium-zod generate` into your build step so stale schemas are caught early.
 * - **AST imports path?** The conformance artifact imports from your grammar's `ast.ts`. If the generated file moves, update `conformance.astTypesPath` to point to the new location or import errors will appear at compile time.
 *
 * **Entry points:**
 * - {@link generateZodSchemas} — main programmatic API (grammar → TypeScript source string)
 * - {@link generateZodCode} — low-level emitter operating on pre-built descriptors
 * - {@link extractTypeDescriptors} — extracts the descriptor tree from `AstTypesLike`
 * - {@link detectRecursiveTypes} — identifies reference cycles before code generation
 * - {@link zRef} — cross-reference validation helper for generated schema factories
 * - {@link ZodSchemaGeneratorModule} — Langium DI module for service-based integration
 *
 * @category Generation
 */
export { generateZodSchemas } from './api.js';
export { DEFAULT_OUTPUT_PATH } from './config.js';
export type { FilterConfig, ZodGeneratorConfig } from './config.js';
export { ZodGeneratorError } from './errors.js';
export { extractTypeDescriptors } from './extractor.js';
export { generateZodCode } from './generator.js';
export { detectRecursiveTypes } from './recursion-detector.js';
export { generate } from './cli.js';
export type { GenerateOptions, LangiumZodConfig } from './cli.js';
export type {
  AstTypesLike,
  InterfaceTypeLike,
  PropertyLike,
  UnionTypeLike,
  ZodPropertyDescriptor,
  ZodTypeDescriptor,
  ZodTypeExpression
} from './types.js';
export { DefaultZodSchemaGenerator, ZodSchemaGeneratorModule } from './di.js';
export type { ZodSchemaGenerator, ZodSchemaGeneratorServices } from './di.js';
export { zRef } from './ref-utils.js';
