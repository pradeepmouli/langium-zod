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
}

export const DEFAULT_OUTPUT_PATH = 'src/generated/zod-schemas.ts';

export function normalizeFilterConfig(config?: FilterConfig): Required<FilterConfig> {
	return {
		include: config?.include ?? [],
		exclude: config?.exclude ?? []
	};
}
