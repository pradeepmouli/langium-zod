import type { Grammar, LangiumCoreServices } from 'langium';
import type { AstTypesLike } from './types.js';

export interface FilterConfig {
	include?: string[];
	exclude?: string[];
}

export interface ZodGeneratorConfig extends FilterConfig {
	grammar?: Grammar | Grammar[];
	services?: LangiumCoreServices;
	outputPath?: string;
	astTypes?: AstTypesLike;
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
}

export const DEFAULT_OUTPUT_PATH = 'src/generated/zod-schemas.ts';

export function normalizeFilterConfig(config?: FilterConfig): Required<FilterConfig> {
	return {
		include: config?.include ?? [],
		exclude: config?.exclude ?? []
	};
}
