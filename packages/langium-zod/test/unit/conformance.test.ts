import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	collectAstExportNames,
	generateConformanceSource,
	inferConformanceOutputPath,
	resolveAstTypesPath
} from '../../src/conformance.js';

describe('conformance helpers', () => {
	it('infers output path and respects override', () => {
		expect(inferConformanceOutputPath('/a/zod-schemas.ts')).toBe('/a/zod-schemas.conformance.ts');
		expect(inferConformanceOutputPath('/a/zod-schemas', '/a/custom.ts')).toBe('/a/custom.ts');
	});

	it('collects AST export names and generates conformance source', () => {
		const dir = join(tmpdir(), `langium-zod-conformance-unit-${crypto.randomUUID()}`);
		mkdirSync(dir, { recursive: true });
		const astPath = join(dir, 'ast.ts');
		const schemaPath = join(dir, 'zod-schemas.ts');

		writeFileSync(
			astPath,
			[
				'export interface Data { $type: "Data"; name: string }',
				'export type Thing = { kind: "thing" }'
			].join('\n'),
			'utf8'
		);
		writeFileSync(schemaPath, 'export const DataSchema = {} as const;', 'utf8');

		try {
			const names = collectAstExportNames(astPath);
			expect(names.has('Data')).toBe(true);
			expect(names.has('Thing')).toBe(true);

			const generated = generateConformanceSource({
				schemaOutputPath: schemaPath,
				astTypesPath: astPath,
				schemaTypeNames: ['Data', 'Missing'],
				stripFields: []
			});

			expect(generated.source).toContain('import type * as AST');
			expect(generated.source).toContain('import { DataSchema }');
			expect(generated.source).toContain('type _Internals = never;');
			expect(generated.missingAstTypes).toEqual(['Missing']);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('resolves ast path from explicit or langium out directory', () => {
		expect(resolveAstTypesPath('/workspace', '/workspace/src/generated')).toBe('/workspace/src/generated/ast.ts');
		expect(resolveAstTypesPath('/workspace', '/workspace/src/generated', './custom/ast.ts')).toBe('/workspace/custom/ast.ts');
	});

	it('generates per-type Pick surface helpers for projected types', () => {
		const testDir = join(tmpdir(), `langium-zod-conformance-projection-${crypto.randomUUID()}`);
		mkdirSync(testDir, { recursive: true });
		const astPath = join(testDir, 'ast.ts');
		const schemaPath = join(testDir, 'zod-schemas.ts');

		writeFileSync(
			astPath,
			'export interface Data { $type: "Data"; name: string; secret: string }',
			'utf8'
		);
		writeFileSync(schemaPath, 'export const DataSchema = {} as const;', 'utf8');

		try {
			const generated = generateConformanceSource({
				schemaOutputPath: schemaPath,
				astTypesPath: astPath,
				schemaTypeNames: ['Data'],
				stripFields: [],
				projection: {
					types: {
						Data: { fields: ['name'] }
					}
				}
			});

			expect(generated.source).toContain('Pick<_Surface<AST.Data>, "$type" | "name">');
			expect(generated.source).not.toContain('_Surface<AST.Data> ? true');
		} finally {
			rmSync(testDir, { recursive: true, force: true });
		}
	});
});
