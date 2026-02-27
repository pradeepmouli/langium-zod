import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { collectAst } from 'langium/grammar';
import type { ZodGeneratorConfig } from './config.js';
import { ZodGeneratorError } from './errors.js';
import { extractTypeDescriptors } from './extractor.js';
import { generateZodCode } from './generator.js';
import { detectRecursiveTypes } from './recursion-detector.js';
import type { AstTypesLike, ZodRegexEnumDescriptor, ZodTypeDescriptor } from './types.js';

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

	const rawDescriptors = extractTypeDescriptors(astTypes, {
		include: config.include,
		exclude: config.exclude
	});

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
	const source = generateZodCode(descriptors, recursiveTypes);

	if (config.outputPath) {
		mkdirSync(dirname(config.outputPath), { recursive: true });
		writeFileSync(config.outputPath, source, 'utf8');
	}

	return source;
}
