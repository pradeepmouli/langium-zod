import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateZodSchemas } from '../../src/index.js';
import { generate, getUnknownFilterNames, resolveFilterOverrides } from '../../src/cli.js';
import { resolveAstTypesPath } from '../../src/conformance.js';
import { loadProjectionConfig } from '../../src/projection.js';
import type { AstTypesLike } from '../../src/types.js';

const runeCorePath = process.env.RUNE_LANGIUM_CORE_PATH ?? '';
const runExternalLangiumTests = process.env.RUN_EXTERNAL_LANGIUM_TESTS === 'true';
const externalTimeoutMs = Number(process.env.EXTERNAL_TEST_TIMEOUT_MS ?? '120000');

const describeExternal =
	runExternalLangiumTests && runeCorePath && existsSync(runeCorePath) ? describe : describe.skip;

describe('langium cli filter options', () => {
	it('parses include/exclude overrides and applies overlap precedence (exclude wins)', () => {
		const resolved = resolveFilterOverrides(
			{
				include: ['FromConfigInclude'],
				exclude: ['FromConfigExclude']
			},
			' TypeA, TypeB, TypeA ',
			' TypeB, TypeC '
		);

		expect(resolved.include).toEqual(['TypeA']);
		expect(resolved.exclude).toEqual(['TypeB', 'TypeC']);
	});

	it('uses config include/exclude when CLI values are not provided', () => {
		const resolved = resolveFilterOverrides(
			{
				include: ['FromConfigInclude'],
				exclude: ['FromConfigExclude']
			},
			undefined,
			undefined
		);

		expect(resolved.include).toEqual(['FromConfigInclude']);
		expect(resolved.exclude).toEqual(['FromConfigExclude']);
	});

	it('reports unknown type names and includes available type names for warnings', () => {
		const unknownInclude = getUnknownFilterNames(
			['KnownType', 'MissingInclude'],
			['KnownType', 'AnotherType']
		);
		const unknownExclude = getUnknownFilterNames(
			['MissingExclude'],
			['KnownType', 'AnotherType']
		);

		expect(unknownInclude).toEqual(['MissingInclude']);
		expect(unknownExclude).toEqual(['MissingExclude']);
		expect(['KnownType', 'AnotherType'].join(', ')).toBe('KnownType, AnotherType');
	});

	it('fails fast for invalid projection files', () => {
		const invalidProjectionPath = join(
			process.cwd(),
			'packages/langium-zod/test/fixtures/projection.invalid.json'
		);

		expect(() => loadProjectionConfig(invalidProjectionPath)).toThrow();
	});

	it('resolves default and explicit conformance ast paths', () => {
		const configDir = '/workspace/config';
		const outDir = '/workspace/config/src/generated';

		expect(resolveAstTypesPath(configDir, outDir)).toBe('/workspace/config/src/generated/ast.ts');
		expect(resolveAstTypesPath(configDir, outDir, './custom/ast.ts')).toBe('/workspace/config/custom/ast.ts');
	});

	it('fails conformance generation when ast path cannot be resolved to an existing file', async () => {
		const dir = join(tmpdir(), `langium-zod-cli-conformance-${crypto.randomUUID()}`);
		mkdirSync(dir, { recursive: true });

		const grammarPath = join(dir, 'simple.langium');
		const configPath = join(dir, 'langium-config.json');
		const outputPath = join(dir, 'generated', 'zod-schemas.ts');

		writeFileSync(grammarPath, readFileSync(join(process.cwd(), 'packages/langium-zod/test/fixtures/simple.langium'), 'utf8'), 'utf8');
		writeFileSync(
			configPath,
			JSON.stringify({
				projectName: 'tmp',
				languages: [{ grammar: './simple.langium' }],
				out: 'generated'
			}),
			'utf8'
		);

		try {
			await expect(
				generate({
					langiumConfigPath: configPath,
					config: {
						outputPath,
						conformance: {}
					}
				})
			).rejects.toThrow('Unable to resolve ast types path for conformance');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('auto-resolves conformance ast path from langium-config out directory', async () => {
		const dir = join(tmpdir(), `langium-zod-cli-conformance-ok-${crypto.randomUUID()}`);
		mkdirSync(join(dir, 'generated'), { recursive: true });

		const grammarPath = join(dir, 'simple.langium');
		const configPath = join(dir, 'langium-config.json');
		const outputPath = join(dir, 'generated', 'zod-schemas.ts');
		const conformancePath = join(dir, 'generated', 'zod-schemas.conformance.ts');

		writeFileSync(grammarPath, readFileSync(join(process.cwd(), 'packages/langium-zod/test/fixtures/simple.langium'), 'utf8'), 'utf8');
		writeFileSync(
			configPath,
			JSON.stringify({
				projectName: 'tmp',
				languages: [{ grammar: './simple.langium' }],
				out: 'generated'
			}),
			'utf8'
		);
		writeFileSync(
			join(dir, 'generated', 'ast.ts'),
			[
				'export interface Greeting { $type: "Greeting"; name: string; count: number; active?: boolean; tags: Tag[]; description?: string }',
				'export interface Tag { $type: "Tag"; name: string }'
			].join('\n'),
			'utf8'
		);

		try {
			await generate({
				langiumConfigPath: configPath,
				config: {
					outputPath,
					conformance: {}
				}
			});

			expect(existsSync(conformancePath)).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

function runExternalCommand(command: string, cwd: string): void {
	execSync(command, {
		cwd,
		stdio: 'pipe',
		timeout: externalTimeoutMs,
		env: {
			...process.env,
			CI: 'true'
		}
	});
}

function collectAstTypesFromRuneCore(cwd: string): AstTypesLike {
	const script = `
import { createRuneDslServices } from './dist/index.js';
import { collectAst } from 'langium/grammar';

const services = createRuneDslServices();
const ast = collectAst(services.RuneDsl.Grammar);

const normalizeType = (type) => {
	if (!type) return undefined;
	if (typeof type === 'string') return type;

	if (type.elementType) {
		return { elementType: normalizeType(type.elementType) };
	}

	if (type.referenceType) {
		const referenceTarget =
			type.referenceType?.value?.name ?? type.referenceType?.name ?? type.referenceType;
		return {
			referenceType: typeof referenceTarget === 'string' ? referenceTarget : undefined,
			isCrossRef: true
		};
	}

	if (type.value?.dataType) return type.value.dataType;
	if (type.value?.name) return type.value.name;
	if (type.primitive) return type.primitive;

	if (Array.isArray(type.types) && type.types.length > 0) {
		const first = type.types[0];
		if (typeof first?.primitive === 'string') return first.primitive;
		if (typeof first?.string === 'string') return 'string';
		if (typeof first?.name === 'string') return first.name;
		if (typeof first?.value?.name === 'string') return first.value.name;
		return 'string';
	}

	return undefined;
};

const normalizeUnionMembers = (unionType) => {
	const candidates = unionType?.type?.types ?? unionType?.types ?? [];
	if (!Array.isArray(candidates)) return [];

	const members = [];
	for (const candidate of candidates) {
		const name = candidate?.value?.name ?? candidate?.name ?? candidate?.type ?? candidate;
		if (typeof name === 'string') members.push(name);
	}
	return members;
};

const normalized = {
	interfaces: ast.interfaces.map((entry) => ({
		name: entry.name,
		superTypes: Array.from(entry.superTypes ?? [])
			.map((item) => (typeof item === 'string' ? item : item?.name))
			.filter((item) => typeof item === 'string'),
		properties: (entry.properties ?? [])
			.map((property) => {
				const normalizedType = normalizeType(property.type);
				if (normalizedType === undefined) {
					return undefined;
				}

				return {
					name: property.name,
					optional: Boolean(property.optional),
					assignment: property.type?.elementType ? '+=' : '=',
					type: normalizedType,
					isCrossRef: Boolean(property.type?.referenceType)
				};
			})
			.filter(Boolean)
	})),
	unions: ast.unions
		.map((entry) => ({
			name: entry.name,
			members: normalizeUnionMembers(entry)
		}))
		.filter((entry) => entry.members.length > 0)
};

console.log(JSON.stringify(normalized));
`;

	const scriptPath = join(cwd, '.tmp-langium-zod-collect-ast.mjs');
	writeFileSync(scriptPath, script, 'utf8');

	const raw = execSync(`node ${scriptPath}`, {
		cwd,
		stdio: 'pipe',
		timeout: externalTimeoutMs
	}).toString();

	rmSync(scriptPath, { force: true });

	return JSON.parse(raw) as AstTypesLike;
}

describeExternal('langium cli external integration (rune-langium)', () => {
	it('runs langium CLI generation and then generates zod schemas from RuneDsl grammar', () => {
		runExternalCommand('pnpm generate', runeCorePath);

		runExternalCommand('pnpm build', runeCorePath);

		const generatedAstPath = join(runeCorePath, 'src/generated/ast.ts');
		expect(existsSync(generatedAstPath)).toBe(true);
		expect(readFileSync(generatedAstPath, 'utf8')).toContain('export interface');

		const astTypes = collectAstTypesFromRuneCore(runeCorePath);
		expect(astTypes.interfaces.length).toBeGreaterThan(0);

		const source = generateZodSchemas({
			grammar: {} as never,
			astTypes
		});

		expect(source).toContain("import { z } from 'zod';");
		expect(source).toContain('Schema = z.looseObject(');
		expect(source).toContain('"$type": z.literal(');
	});
});
