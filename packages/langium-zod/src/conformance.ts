import { dirname, extname, relative, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import type { ProjectionConfig } from './projection.js';

export interface ConformanceGenerationOptions {
	schemaOutputPath: string;
	conformanceOutputPath?: string;
	astTypesPath: string;
	schemaTypeNames: string[];
	stripFields: string[];
	projection?: ProjectionConfig;
}

function toPosixPath(path: string): string {
	return path.split('\\').join('/');
}

function ensureImportPath(path: string): string {
	if (path.startsWith('.')) {
		return path;
	}
	return `./${path}`;
}

function replaceWithJsExtension(path: string): string {
	if (path.endsWith('.ts')) {
		return `${path.slice(0, -3)}.js`;
	}
	if (!extname(path)) {
		return `${path}.js`;
	}
	return path;
}

export function inferConformanceOutputPath(
	schemaOutputPath: string,
	overridePath?: string,
): string {
	if (overridePath) {
		return overridePath;
	}

	if (schemaOutputPath.endsWith('.ts')) {
		return `${schemaOutputPath.slice(0, -3)}.conformance.ts`;
	}
	return `${schemaOutputPath}.conformance.ts`;
}

export function collectAstExportNames(astTypesPath: string): Set<string> {
	const source = readFileSync(astTypesPath, 'utf8');
	const names = new Set<string>();
	const re = /export\s+(?:interface|type)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
	let match = re.exec(source);

	while (match) {
		const name = match[1];
		if (name) {
			names.add(name);
		}
		match = re.exec(source);
	}

	return names;
}

export function generateConformanceSource(
	options: ConformanceGenerationOptions,
): { source: string; missingAstTypes: string[] } {
	const conformanceDir = dirname(options.conformanceOutputPath ?? options.schemaOutputPath);
	const astImport = ensureImportPath(
		toPosixPath(replaceWithJsExtension(relative(conformanceDir, options.astTypesPath))),
	);
	const schemaImport = ensureImportPath(
		toPosixPath(replaceWithJsExtension(relative(conformanceDir, options.schemaOutputPath))),
	);

	const astExports = collectAstExportNames(options.astTypesPath);
	const matchedSchemaNames: string[] = [];
	const missingAstTypes: string[] = [];

	for (const typeName of options.schemaTypeNames) {
		if (astExports.has(typeName)) {
			matchedSchemaNames.push(typeName);
		} else {
			missingAstTypes.push(typeName);
		}
	}

	const stripUnion = options.stripFields.length > 0
		? options.stripFields.map((field) => JSON.stringify(field)).join(' | ')
		: 'never';
	const schemaImports = matchedSchemaNames.map((name) => `${name}Schema`).join(', ');

	const lines: string[] = [
		'// generated conformance file',
		"import type { z } from 'zod';",
		`import type * as AST from ${JSON.stringify(astImport)};`
	];

	if (schemaImports.length > 0) {
		lines.push(`import { ${schemaImports} } from ${JSON.stringify(schemaImport)};`);
	}

	lines.push('');
	lines.push(`type _Internals = ${stripUnion};`);
	lines.push('type _Surface<T> = _Internals extends never ? T : Omit<T, _Internals>;');
	lines.push('');

	for (const typeName of matchedSchemaNames) {
		const projectedFields = options.projection?.types?.[typeName]?.fields;
		let surfaceType: string;
		if (Array.isArray(projectedFields)) {
			const allowlist = ['$type', ...projectedFields].map((f) => JSON.stringify(f)).join(' | ');
			surfaceType = `Pick<_Surface<AST.${typeName}>, Extract<keyof _Surface<AST.${typeName}>, ${allowlist}>>`;
		} else {
			surfaceType = `_Surface<AST.${typeName}>`;
		}
		lines.push(`type _Fwd_${typeName} = z.infer<typeof ${typeName}Schema> extends ${surfaceType} ? true : never;`);
		lines.push(`type _Rev_${typeName} = ${surfaceType} extends z.infer<typeof ${typeName}Schema} ? true : never;`);
		lines.push('');
	}

	return {
		source: `${lines.join('\n').trim()}\n`,
		missingAstTypes
	};
}

export function resolveAstTypesPath(
	configDir: string,
	langiumOutDir: string,
	explicitAstTypesPath?: string,
): string {
	if (explicitAstTypesPath) {
		return resolve(configDir, explicitAstTypesPath);
	}
	return resolve(langiumOutDir, 'ast.ts');
}
