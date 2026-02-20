import { createRequire } from 'module';
import type { AstTypesLike } from './types.js';
import type { ZodGeneratorConfig } from './config.js';
import { DEFAULT_OUTPUT_PATH } from './config.js';
import { ZodGeneratorError } from './errors.js';
import { extractTypeDescriptors } from './extractor.js';
import { generateZodCode } from './generator.js';
import { detectRecursiveTypes } from './recursion-detector.js';

const requireModule = createRequire(import.meta.url);

function loadCollectAst(): (grammar: unknown) => AstTypesLike {
	const candidatePaths = [
		'langium/grammar',
		'langium/lib/grammar/index.js',
		'langium/lib/grammar/type-system/ast-collector.js'
	];

	for (const candidate of candidatePaths) {
		try {
			const module = requireModule(candidate) as Record<string, unknown>;
			if (typeof module['collectAst'] === 'function') {
				return module['collectAst'] as (grammar: unknown) => AstTypesLike;
			}
		} catch {
			continue;
		}
	}

	throw new ZodGeneratorError('Unable to locate Langium collectAst API', {
		suggestion: 'Install langium@4 and ensure ESM imports are available'
	});
}

function resolveAstTypes(astTypes: AstTypesLike): AstTypesLike {
	return {
		interfaces: astTypes.interfaces ?? [],
		unions: astTypes.unions ?? []
	};
}

export function generateZodSchemas(config: ZodGeneratorConfig): string {
	if (!config?.grammar) {
		throw new ZodGeneratorError('Missing required grammar in ZodGeneratorConfig', {
			suggestion: 'Pass grammar from your Langium services into generateZodSchemas()'
		});
	}

	const astTypes = config.astTypes
		? resolveAstTypes(config.astTypes)
		: resolveAstTypes(loadCollectAst()(config.grammar));
	const descriptors = extractTypeDescriptors(astTypes, {
		include: config.include,
		exclude: config.exclude
	});
	const recursiveTypes = detectRecursiveTypes(descriptors);
	const source = generateZodCode(descriptors, recursiveTypes);
	void config.outputPath;
	return source;
}

export { DEFAULT_OUTPUT_PATH } from './config.js';
export type { FilterConfig, ZodGeneratorConfig } from './config.js';
export { ZodGeneratorError } from './errors.js';
export { extractTypeDescriptors } from './extractor.js';
export { generateZodCode } from './generator.js';
export { detectRecursiveTypes } from './recursion-detector.js';
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
