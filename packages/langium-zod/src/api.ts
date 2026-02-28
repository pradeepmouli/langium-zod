import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { collectAst } from 'langium/grammar';
import type { ZodGeneratorConfig } from './config.js';
import { generateConformanceSource, inferConformanceOutputPath } from './conformance.js';
import { ZodGeneratorError } from './errors.js';
import { extractTypeDescriptors } from './extractor.js';
import { generateZodCode } from './generator.js';
import { applyProjectionToDescriptors, resolveEffectiveStripFields } from './projection.js';
import { detectRecursiveTypes } from './recursion-detector.js';
import type { AstTypesLike, ZodRegexEnumDescriptor, ZodTypeDescriptor } from './types.js';

export type PublicZodGeneratorConfig = ZodGeneratorConfig;

function resolveAstTypes(astTypes: AstTypesLike): AstTypesLike {
	return {
		interfaces: astTypes.interfaces ?? [],
		unions: astTypes.unions ?? []
	};
}

export function generateZodSchemas(config: ZodGeneratorConfig): string {
	let rawAstTypes: AstTypesLike;
	if (config.astTypes) {
		rawAstTypes = config.astTypes;
	} else if (config.grammar) {
		rawAstTypes = collectAst(config.grammar) as unknown as AstTypesLike;
	} else {
		throw new ZodGeneratorError('Missing grammar or astTypes in ZodGeneratorConfig', {
			suggestion: "Provide astTypes from Langium's collectAst() or pass a grammar object"
		});
	}

	const astTypes = resolveAstTypes(rawAstTypes);
	const rawDescriptors = buildDescriptorPipeline(astTypes, config);

	// Apply regexOverrides: upgrade primitive-alias schemas to regex-enum for types
	// whose Langium grammar rule is too complex for automatic regex derivation.
	const overrides = config.regexOverrides ?? {};
	const descriptors: ZodTypeDescriptor[] = rawDescriptors.map((d) => {
		const override = overrides[d.name];
		if (override && (d.kind === 'primitive-alias' || d.kind === 'regex-enum')) {
			return {
				name: d.name,
				kind: 'regex-enum',
				regex: override,
				keywords: d.kind === 'regex-enum' ? (d as ZodRegexEnumDescriptor).keywords : []
			} satisfies ZodRegexEnumDescriptor;
		}
		return d;
	});

	const recursiveTypes = detectRecursiveTypes(descriptors);
	const surfaceDescriptors = applyProjectionToDescriptors(descriptors, {
		projection: config.projection,
		stripInternals: config.stripInternals
	});
	const source = generateZodCode(descriptors, recursiveTypes, {
		projection: config.projection,
		stripInternals: config.stripInternals,
		crossRefValidation: config.crossRefValidation
	});

	if (config.outputPath) {
		mkdirSync(dirname(config.outputPath), { recursive: true });
		writeFileSync(config.outputPath, source, 'utf8');
	}

	if (config.conformance) {
		if (!config.outputPath) {
			throw new ZodGeneratorError('Conformance generation requires outputPath', {
				suggestion: 'Provide outputPath when conformance generation is enabled'
			});
		}

		if (!config.conformance.astTypesPath) {
			throw new ZodGeneratorError('Conformance generation requires astTypesPath', {
				suggestion: 'Provide conformance.astTypesPath or use CLI --ast-types/auto-resolution'
			});
		}

		const schemaTypeNames = surfaceDescriptors
			.filter((descriptor) => descriptor.kind === 'object')
			.map((descriptor) => descriptor.name);

		if (schemaTypeNames.length === 0) {
			console.warn('Warning: Conformance generation skipped because no schemas remain after filtering.');
			return source;
		}

		const conformanceOutputPath = inferConformanceOutputPath(
			config.outputPath,
			config.conformance.outputPath,
		);
		const conformance = generateConformanceSource({
			schemaOutputPath: config.outputPath,
			conformanceOutputPath,
			astTypesPath: config.conformance.astTypesPath,
			schemaTypeNames,
			stripFields: resolveEffectiveStripFields({
				projection: config.projection,
				stripInternals: config.stripInternals
			}),
			projection: config.projection
		});

		for (const missingType of conformance.missingAstTypes) {
			console.warn(`Warning: Missing AST export for conformance type ${missingType}; skipping.`);
		}

		mkdirSync(dirname(conformanceOutputPath), { recursive: true });
		writeFileSync(conformanceOutputPath, conformance.source, 'utf8');
	}

	return source;
}

function buildDescriptorPipeline(astTypes: AstTypesLike, config: ZodGeneratorConfig): ZodTypeDescriptor[] {
	const descriptors = extractTypeDescriptors(astTypes, {
		include: config.include,
		exclude: config.exclude
	});

	return descriptors;
}
