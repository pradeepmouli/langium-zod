import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateZodSchemas } from '../../src/index.js';
import type { AstTypesLike } from '../../src/types.js';

const runeCorePath = process.env.RUNE_LANGIUM_CORE_PATH ?? '';

const describeExternal = runeCorePath && existsSync(runeCorePath) ? describe : describe.skip;

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
		stdio: 'pipe'
	}).toString();

	rmSync(scriptPath, { force: true });

	return JSON.parse(raw) as AstTypesLike;
}

describeExternal('langium cli external integration (rune-langium)', () => {
	it('runs langium CLI generation and then generates zod schemas from RuneDsl grammar', () => {
		execSync('pnpm generate', {
			cwd: runeCorePath,
			stdio: 'pipe'
		});

		execSync('pnpm build', {
			cwd: runeCorePath,
			stdio: 'pipe'
		});

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
