import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateZodSchemas } from '../../src/index.js';
import { ZodGeneratorError } from '../../src/errors.js';
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
});
