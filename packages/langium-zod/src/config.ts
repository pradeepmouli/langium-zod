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
 */
export const DEFAULT_OUTPUT_PATH = 'src/generated/zod-schemas.ts';

export function normalizeFilterConfig(config?: FilterConfig): Required<FilterConfig> {
	return {
		include: config?.include ?? [],
		exclude: config?.exclude ?? []
	};
}
