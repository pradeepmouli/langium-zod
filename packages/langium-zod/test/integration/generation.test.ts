import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateZodSchemas } from '../../src/index.js';
import { ZodGeneratorError } from '../../src/errors.js';
import { zRef } from '../../src/ref-utils.js';
import type { AstTypesLike } from '../../src/types.js';

const fixturePath = (name: string): string => join(process.cwd(), 'packages/langium-zod/test/fixtures', name);

const simpleAstTypes: AstTypesLike = {
	interfaces: [
		{
			name: 'Tag',
			properties: [{ name: 'name', type: 'ID', optional: false }]
		},
		{
			name: 'Greeting',
			properties: [
				{ name: 'name', type: 'ID', optional: false },
				{ name: 'count', type: 'INT', optional: false },
				{ name: 'active', assignment: '?=', optional: false },
				{ name: 'tags', type: 'Tag', assignment: '+=', optional: false },
				{ name: 'description', type: 'STRING', optional: true }
			]
		}
	],
	unions: []
};

const hierarchyAstTypes: AstTypesLike = {
	interfaces: [
		{ name: 'Element', properties: [{ name: 'name', type: 'ID', optional: false }] },
		{ name: 'Entity', superTypes: ['Element'], properties: [{ name: 'features', type: 'Feature', assignment: '+=', optional: false }] },
		{ name: 'DataType', superTypes: ['Element'], properties: [{ name: 'typeName', type: 'STRING', optional: false }] },
		{ name: 'Feature', properties: [{ name: 'name', type: 'ID', optional: false }] }
	],
	unions: [{ name: 'AbstractElement', members: ['Entity', 'DataType'] }]
};

const crossRefAstTypes: AstTypesLike = {
	interfaces: [
		{ name: 'Variable', properties: [{ name: 'name', type: 'ID', optional: false }] },
		{
			name: 'VariableRef',
			properties: [{ name: 'variable', type: 'Variable', optional: false, isCrossRef: true }]
		}
	],
	unions: []
};

const cardinalityAstTypes: AstTypesLike = {
	interfaces: [
		{
			name: 'Item',
			properties: [{ name: 'name', type: 'ID', optional: false }]
		},
		{
			name: 'Container',
			properties: [
				{ name: 'requiredItems', type: 'Item', assignment: '+=', cardinality: '+', optional: false },
				{ name: 'optionalItems', type: 'Item', assignment: '+=', cardinality: '*', optional: false },
				{ name: 'plainItems', type: 'Item', assignment: '+=', optional: false }
			]
		}
	],
	unions: []
};

const projectionAstTypes: AstTypesLike = {
	interfaces: [
		{
			name: 'Data',
			properties: [
				{ name: 'name', type: 'ID', optional: false },
				{ name: 'superType', type: 'ID', optional: true },
				{ name: '$container', type: 'STRING', optional: true },
				{ name: '$document', type: 'STRING', optional: true }
			]
		}
	],
	unions: []
};

describe('generation integration', () => {
	it('reads simple fixture and generates schema source for primitive/array/optional mappings', () => {
		expect(readFileSync(fixturePath('simple.langium'), 'utf8')).toContain('Greeting');
		const source = generateZodSchemas({
			grammar: {} as never,
			astTypes: simpleAstTypes
		});

		expect(source).toContain("import { z } from 'zod';");
		expect(source).toContain('export const GreetingSchema = z.looseObject({');
		expect(source).toContain('export const AstNodeSchema = z.discriminatedUnion("$type", [TagSchema, GreetingSchema]);');
		expect(source).toContain('"$type": z.literal("Greeting")');
		expect(source).toContain('"name": z.string()');
		expect(source).toContain('"count": z.number()');
		expect(source).toContain('"active": z.boolean()');
		expect(source).toContain('"tags": z.array(TagSchema)');
		expect(source).toContain('"description": z.string().optional()');
	});

	it('generates discriminated unions for hierarchy types', () => {
		expect(readFileSync(fixturePath('hierarchy.langium'), 'utf8')).toContain('type AbstractElement');
		const source = generateZodSchemas({
			grammar: {} as never,
			astTypes: hierarchyAstTypes
		});

		expect(source).toContain('export const EntitySchema = z.looseObject({');
		expect(source).toContain('"name": z.string()');
		expect(source).toContain('"features": z.array(FeatureSchema)');
		expect(source).toContain('export const AbstractElementSchema = z.discriminatedUnion("$type", [EntitySchema, DataTypeSchema]);');
		expect(source).toContain('export const AstNodeSchema = z.discriminatedUnion("$type", [ElementSchema, FeatureSchema, EntitySchema, DataTypeSchema]);');
	});

	it('emits shared ReferenceSchema for cross references', () => {
		expect(readFileSync(fixturePath('crossref.langium'), 'utf8')).toContain('variable=[Variable]');
		const source = generateZodSchemas({
			grammar: {} as never,
			astTypes: crossRefAstTypes
		});

		expect(source).toContain('export const ReferenceSchema = z.looseObject({');
		expect(source).toContain('"$refText": z.string()');
		expect(source).toContain('"variable": ReferenceSchema');
	});

	it('handles recursive types with getter pattern', () => {
		expect(readFileSync(fixturePath('recursive.langium'), 'utf8')).toContain('TreeNode');
		const source = generateZodSchemas({
			grammar: {} as never,
			astTypes: {
				interfaces: [
					{
						name: 'TreeNode',
						properties: [
							{ name: 'name', type: 'ID', optional: false },
							{ name: 'children', type: 'TreeNode', assignment: '+=', optional: true }
						]
					}
				],
				unions: []
			}
		});

		expect(source).toContain('get children() { return z.array(TreeNodeSchema).optional(); }');
	});

	it('throws ZodGeneratorError for unmappable property types with suggestion', () => {
		expect(() =>
			generateZodSchemas({
				grammar: {} as never,
				astTypes: {
					interfaces: [
						{
							name: 'Broken',
							properties: [{ name: 'mystery', type: undefined, optional: false }]
						}
					],
					unions: []
				}
			})
		).toThrow(ZodGeneratorError);

		try {
			generateZodSchemas({
				grammar: {} as never,
				astTypes: {
					interfaces: [
						{
							name: 'Broken',
							properties: [{ name: 'mystery', type: undefined, optional: false }]
						}
					],
					unions: []
				}
			});
		} catch (error) {
			const typed = error as ZodGeneratorError;
			expect(typed.typeName).toBe('Broken');
			expect(typed.suggestion).toContain('resolvable terminal');
		}
	});

	it('emits referred type before referring type (topo sort avoids TDZ)', () => {
		// Consumer is listed first in the input but references Producer,
		// so ProducerSchema must be declared before ConsumerSchema.
		const source = generateZodSchemas({
			astTypes: {
				interfaces: [
					{
						name: 'Consumer',
						properties: [{ name: 'item', type: 'Producer', optional: false }]
					},
					{
						name: 'Producer',
						properties: [{ name: 'name', type: 'ID', optional: false }]
					}
				],
				unions: []
			}
		});

		const producerIdx = source.indexOf('export const ProducerSchema');
		const consumerIdx = source.indexOf('export const ConsumerSchema');
		expect(producerIdx).toBeGreaterThanOrEqual(0);
		expect(consumerIdx).toBeGreaterThanOrEqual(0);
		expect(producerIdx).toBeLessThan(consumerIdx);
	});

	it('emits getters for all cycle members in a mutually-recursive pair', () => {
		// ExprNode ↔ TermNode: both should use getter syntax for their cross-type reference.
		const source = generateZodSchemas({
			astTypes: {
				interfaces: [
					{
						name: 'ExprNode',
						properties: [{ name: 'term', type: 'TermNode', optional: false }]
					},
					{
						name: 'TermNode',
						properties: [{ name: 'expr', type: 'ExprNode', optional: false }]
					}
				],
				unions: []
			}
		});

		expect(source).toContain('export const ExprNodeSchema = z.looseObject({');
		expect(source).toContain('export const TermNodeSchema = z.looseObject({');
		expect(source).toContain('get term() { return TermNodeSchema; }');
		expect(source).toContain('get expr() { return ExprNodeSchema; }');
	});

	it('writes generated source to outputPath and creates the directory', () => {
		const tmpDir = join(tmpdir(), `langium-zod-test-${crypto.randomUUID()}`);
		const outputPath = join(tmpDir, 'generated', 'zod-schemas.ts');

		try {
			const source = generateZodSchemas({
				astTypes: simpleAstTypes,
				outputPath
			});

			expect(existsSync(outputPath)).toBe(true);
			expect(readFileSync(outputPath, 'utf8')).toBe(source);
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it('emits .min(1) only for += properties with + cardinality', () => {
		const source = generateZodSchemas({
			astTypes: cardinalityAstTypes
		});

		expect(source).toContain('"requiredItems": z.array(ItemSchema).min(1)');
		expect(source).toContain('"optionalItems": z.array(ItemSchema)');
		expect(source).toContain('"plainItems": z.array(ItemSchema)');
		expect(source).not.toContain('"optionalItems": z.array(ItemSchema).min(1)');
		expect(source).not.toContain('"plainItems": z.array(ItemSchema).min(1)');
	});

	it('removes internal fields when strip-internals is enabled', () => {
		const source = generateZodSchemas({
			astTypes: projectionAstTypes,
			stripInternals: true
		});

		expect(source).toContain('"$type": z.literal("Data")');
		expect(source).toContain('"name": z.string()');
		expect(source).toContain('"superType": z.string().optional()');
		expect(source).not.toContain('"$container":');
		expect(source).not.toContain('"$document":');
	});

	it('applies projection fields while keeping $type', () => {
		const source = generateZodSchemas({
			astTypes: projectionAstTypes,
			projection: {
				types: {
					Data: {
						fields: ['name']
					}
				}
			}
		});

		expect(source).toContain('"$type": z.literal("Data")');
		expect(source).toContain('"name": z.string()');
		expect(source).not.toContain('"superType":');
		expect(source).not.toContain('"$container":');
		expect(source).not.toContain('"$document":');
	});

	it('generates conformance artifact with strip-aware internals', () => {
		const tmpDir = join(tmpdir(), `langium-zod-conformance-${crypto.randomUUID()}`);
		const outputPath = join(tmpDir, 'generated', 'zod-schemas.ts');
		const astPath = join(tmpDir, 'generated', 'ast.ts');
		const conformancePath = join(tmpDir, 'generated', 'zod-schemas.conformance.ts');

		mkdirSync(join(tmpDir, 'generated'), { recursive: true });
		writeFileSync(astPath, 'export interface Data { $type: "Data"; name: string; superType?: string }\n', 'utf8');

		try {
			generateZodSchemas({
				astTypes: projectionAstTypes,
				outputPath,
				stripInternals: true,
				conformance: {
					astTypesPath: astPath
				}
			});

			expect(existsSync(conformancePath)).toBe(true);
			const conformanceSource = readFileSync(conformancePath, 'utf8');
			expect(conformanceSource).toContain('type _Internals = "$container" | "$containerProperty" | "$containerIndex" | "$document" | "$cstNode";');
			expect(conformanceSource).toContain('type _Fwd_Data = z.infer<typeof DataSchema> extends _Surface<AST.Data> ? true : never;');
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it('warns and skips missing AST exports in conformance output', () => {
		const tmpDir = join(tmpdir(), `langium-zod-conformance-missing-${crypto.randomUUID()}`);
		const outputPath = join(tmpDir, 'generated', 'zod-schemas.ts');
		const astPath = join(tmpDir, 'generated', 'ast.ts');
		const conformancePath = join(tmpDir, 'generated', 'zod-schemas.conformance.ts');

		mkdirSync(join(tmpDir, 'generated'), { recursive: true });
		writeFileSync(astPath, 'export interface Tag { $type: "Tag"; name: string }\n', 'utf8');

		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		try {
			generateZodSchemas({
				astTypes: simpleAstTypes,
				outputPath,
				conformance: {
					astTypesPath: astPath
				}
			});

			expect(existsSync(conformancePath)).toBe(true);
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Missing AST export for conformance type Greeting')
			);
		} finally {
			warnSpy.mockRestore();
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it('skips conformance emission with warning when no schemas remain after filtering', () => {
		const tmpDir = join(tmpdir(), `langium-zod-conformance-empty-${crypto.randomUUID()}`);
		const outputPath = join(tmpDir, 'generated', 'zod-schemas.ts');
		const astPath = join(tmpDir, 'generated', 'ast.ts');
		const conformancePath = join(tmpDir, 'generated', 'zod-schemas.conformance.ts');

		mkdirSync(join(tmpDir, 'generated'), { recursive: true });
		writeFileSync(astPath, 'export interface Data { $type: "Data"; name: string }\n', 'utf8');

		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		try {
			generateZodSchemas({
				astTypes: projectionAstTypes,
				outputPath,
				include: ['UnknownOnly'],
				conformance: {
					astTypesPath: astPath
				}
			});

			expect(existsSync(outputPath)).toBe(true);
			expect(existsSync(conformancePath)).toBe(false);
			expect(warnSpy).toHaveBeenCalledWith(
				'Warning: Conformance generation skipped because no schemas remain after filtering.'
			);
		} finally {
			warnSpy.mockRestore();
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it('emits cross-reference factories only when validation mode is enabled', () => {
		const baseline = generateZodSchemas({
			astTypes: crossRefAstTypes
		});
		const enhanced = generateZodSchemas({
			astTypes: crossRefAstTypes,
			crossRefValidation: true
		});

		expect(baseline).not.toContain('createVariableRefSchema');
		expect(enhanced).toContain("import { zRef } from 'langium-zod';");
		expect(enhanced).toContain('export interface VariableRefSchemaRefs');
		expect(enhanced).toContain('export function createVariableRefSchema(refs: VariableRefSchemaRefs = {})');
	});

	it('validates references via zRef and remains permissive without reference context', () => {
		const strict = zRef(['known']);
		expect(strict.safeParse('known').success).toBe(true);
		expect(strict.safeParse('missing').success).toBe(false);

		const permissiveNoRefs = zRef([]);
		expect(permissiveNoRefs.safeParse('anything').success).toBe(true);

		const optionalRef = zRef(['known']).optional();
		expect(optionalRef.safeParse(undefined).success).toBe(true);
		expect(optionalRef.safeParse('').success).toBe(true);
		expect(optionalRef.safeParse('   ').success).toBe(true);
	});

	it('does not emit cross-reference refinements for projection-stripped fields', () => {
		const source = generateZodSchemas({
			astTypes: crossRefAstTypes,
			crossRefValidation: true,
			projection: {
				types: {
					VariableRef: {
						fields: []
					}
				}
			}
		});

		expect(source).not.toContain('createVariableRefSchema');
		expect(source).toContain('export const VariableRefSchema = z.looseObject({');
		expect(source).toContain('"$type": z.literal("VariableRef")');
		expect(source).not.toContain('"variable": ReferenceSchema');
	});
});
