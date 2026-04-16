import type { Grammar, LangiumCoreServices } from 'langium';
import type { AstTypesLike } from './types.js';
import type { ProjectionConfig } from './projection.js';

/**
 * Include/exclude filter that controls which Langium type names are emitted
 * during schema generation.
 *
 * When `include` is non-empty, only the listed type names (and any stub types
 * they reference) are generated. When `exclude` is non-empty, the listed names
 * are skipped. If both are supplied, `exclude` takes precedence for names that
 * appear in both lists. An empty (or omitted) `FilterConfig` emits all types.
 *
 * @remarks
 * Stub types — referenced type names that have no corresponding interface or union
 * in the grammar (e.g. standalone datatype rules like `ValidID`) — are only emitted
 * when neither `include` nor `exclude` suppresses them. If you use `include`, you
 * must enumerate stub type names explicitly if you want them in the output.
 *
 * @example
 * ```ts
 * // Emit only two types + any stubs they transitively reference
 * const filter: FilterConfig = { include: ['Greeting', 'Person'] };
 *
 * // Suppress internal Langium bookkeeping types
 * const filter: FilterConfig = { exclude: ['AbstractElement', 'NamedElement'] };
 * ```
 *
 * @useWhen
 * - You want to emit schemas for only a curated subset of your grammar's types.
 * - You need to exclude abstract base types that your application never validates directly.
 * - You are generating incremental schemas for a large grammar where only a few types change.
 *
 * @avoidWhen
 * - You want all grammar types — omit `FilterConfig` entirely or pass `{}`.
 * - You need to exclude fields within a type (not the whole type) — use `projection` in
 *   {@link ZodGeneratorConfig} instead.
 *
 * @pitfalls
 * - NEVER include a union type in `include` without also including all of its member interface
 *   types. BECAUSE the union descriptor references its members by name; absent members produce
 *   a discriminated union with zero branches, which Zod rejects at runtime.
 * - NEVER rely on `exclude` to strip security-sensitive fields from the generated schema at
 *   runtime. BECAUSE filtering operates on whole types, not fields; use `projection` to strip
 *   individual fields.
 *
 * @config
 * @category Configuration
 * @see {@link ZodGeneratorConfig}
 */
export interface FilterConfig {
  include?: string[];
  exclude?: string[];
}

/**
 * Full configuration object for {@link generateZodSchemas}.
 *
 * At least one of `grammar` or `astTypes` must be provided:
 * - `grammar` — a parsed Langium `Grammar` AST (or array for multi-grammar
 *   projects); the extractor calls Langium's `collectAst()` internally.
 * - `astTypes` — a pre-built {@link AstTypesLike} descriptor, useful when the
 *   caller already has the type model and wants to skip grammar parsing.
 *
 * All other fields are optional and control output path, include/exclude
 * filtering, projection, strip-internals, cross-reference validation, conformance
 * artifact generation, regex overrides, form metadata emission, and object style.
 *
 * @remarks
 * `ZodGeneratorConfig` extends {@link FilterConfig}, so `include` and `exclude`
 * are top-level fields. When both `grammar` and `astTypes` are supplied, `astTypes`
 * is used and `grammar` is ignored — this allows callers that have already run
 * `collectAst()` to skip a redundant parse.
 *
 * The `objectStyle` field defaults to `'loose'` (emits `z.looseObject`), which
 * allows extra properties in validated objects. Set it to `'strict'` to emit
 * `z.object(...)` if you want Zod's standard stripping behaviour.
 *
 * @example
 * ```ts
 * import { generateZodSchemas } from 'langium-zod';
 *
 * generateZodSchemas({
 *   grammar: parsedGrammar,
 *   outputPath: 'src/generated/zod-schemas.ts',
 *   include: ['Greeting', 'Person'],
 *   stripInternals: true,
 *   objectStyle: 'strict',
 *   regexOverrides: {
 *     BigDecimal: String.raw`^[+-]?(\.[0-9]+|[0-9]+\.?[0-9]*)([eE][+-]?[0-9]+)?$`
 *   }
 * });
 * ```
 *
 * @useWhen
 * - You need to configure output path, filtering, or projection in a single object.
 * - You are building a config-file-driven pipeline and want type-safe config loading.
 * - You need conformance artifacts and must specify `conformance.astTypesPath`.
 *
 * @avoidWhen
 * - You only need a quick one-liner with defaults — pass only `{ grammar }` inline.
 * - You are using the CLI — the `langium-zod.config.js` file maps to {@link LangiumZodConfig},
 *   not directly to `ZodGeneratorConfig`.
 *
 * @pitfalls
 * - NEVER set `conformance` without `outputPath`. BECAUSE the conformance module derives
 *   the conformance output path from the schema file's directory; without `outputPath` the
 *   function throws before writing any output.
 * - NEVER mix `grammar` (multi-grammar array) with `astTypes` — if `astTypes` is set it
 *   takes priority and the `grammar` field is silently ignored. BECAUSE the code path
 *   short-circuits to the pre-built descriptor immediately.
 * - NEVER assume `objectStyle: 'strict'` rejects unknown properties. BECAUSE Zod's
 *   `z.object()` strips (not rejects) unknown properties by default; call `.strict()` on
 *   the generated schema if hard rejection is required.
 *
 * @config
 * @category Configuration
 * @see {@link generateZodSchemas}
 * @see {@link FilterConfig}
 */
export interface ZodGeneratorConfig extends FilterConfig {
  grammar?: Grammar | Grammar[];
  services?: LangiumCoreServices;
  outputPath?: string;
  astTypes?: AstTypesLike;
  projection?: ProjectionConfig;
  stripInternals?: boolean;
  crossRefValidation?: boolean;
  conformance?: {
    astTypesPath?: string;
    outputPath?: string;
  };
  /**
   * Override the generated schema for specific type names.
   *
   * Use this for parser-based datatype rules (e.g. `BigDecimal returns string: ... INT ...`)
   * whose structure cannot be expressed as a regex automatically by Langium.
   *
   * The value is a raw regex pattern string (without surrounding `/` slashes).
   * The named type will emit `z.string().regex(new RegExp("..."))` instead of `z.string()`.
   *
   * @example
   * ```ts
   * regexOverrides: {
   *   BigDecimal: String.raw`^[+-]?(\.[0-9]+|[0-9]+\.?[0-9]*)([eE][+-]?[0-9]+)?$`
   * }
   * ```
   */
  regexOverrides?: Record<string, string>;
  /**
   * When `true`, emit `.meta({ title, description? })` on generated Zod schemas
   * using humanized property/type names as `title` and JSDoc comments from the grammar
   * as `description`. The `description` field is only included when a JSDoc/grammar
   * comment exists for the corresponding type or property. Useful for zod-to-forms
   * integrations that derive field labels from metadata.
   */
  formMetadata?: boolean;
  /**
   * Controls how object schemas are emitted.
   * - `'loose'` (default): emits `z.looseObject(...)` which allows extra properties to
   *   pass through unchanged.
   * - `'strict'`: emits `z.object(...)` (the standard Zod object). This strips unknown
   *   properties by default instead of rejecting them with a validation error. Consumers
   *   can call `.strict()` on the emitted schema if they need hard rejection of unknown
   *   properties.
   */
  objectStyle?: 'loose' | 'strict';
}

/**
 * Default output path used when no explicit `outputPath` is provided and the
 * project's `langium-config.json` does not declare an `out` directory.
 *
 * @remarks
 * This constant is used by the CLI when neither `--out` nor the `langium-config.json`
 * `out` field provides an output location. Programmatic callers that do not set
 * `config.outputPath` will not write to disk regardless of this constant — the
 * generated source is returned as a string only.
 *
 * @defaultValue `'src/generated/zod-schemas.ts'`
 *
 * @category Configuration
 * @see {@link ZodGeneratorConfig}
 */
export const DEFAULT_OUTPUT_PATH = 'src/generated/zod-schemas.ts';

export function normalizeFilterConfig(config?: FilterConfig): Required<FilterConfig> {
  return {
    include: config?.include ?? [],
    exclude: config?.exclude ?? []
  };
}
