import { describe, expect, it } from 'vitest';
import { extractTypeDescriptors } from '../../src/extractor.js';
import type { AstTypesLike } from '../../src/types.js';

const baseAstTypes: AstTypesLike = {
	interfaces: [
		{
			name: 'Element',
			properties: [{ name: 'name', type: 'ID', optional: false }]
		},
		{
			name: 'Entity',
			superTypes: new Set(['Element']),
			properties: [{ name: 'features', type: 'Feature', optional: false, assignment: '+=' }]
		},
		{
			name: 'DataType',
			superTypes: new Set(['Element']),
			properties: [{ name: 'typeName', type: 'STRING', optional: false }]
		}
	],
	unions: [
		{
			name: 'AbstractElement',
			members: ['Entity', 'DataType']
		}
	]
};

describe('extractor', () => {
	it('transforms interfaces and adds $type literal', () => {
		const descriptors = extractTypeDescriptors(baseAstTypes);
		const entity = descriptors.find((entry) => entry.name === 'Entity' && entry.kind === 'object');
		if (!entity || entity.kind !== 'object') {
			throw new Error('Entity descriptor not found');
		}

		expect(entity.properties.find((property) => property.name === '$type')?.zodType).toEqual({
			kind: 'literal',
			value: 'Entity'
		});
		expect(entity.properties.some((property) => property.name === 'name')).toBe(true);
		expect(entity.properties.some((property) => property.name === 'features')).toBe(true);
	});

	it('creates union descriptors with discriminator', () => {
		const descriptors = extractTypeDescriptors(baseAstTypes);
		const union = descriptors.find((entry) => entry.name === 'AbstractElement');

		expect(union).toEqual({
			name: 'AbstractElement',
			kind: 'union',
			members: ['Entity', 'DataType'],
			discriminator: '$type'
		});
	});

	it('applies include/exclude filtering', () => {
		const includeOnlyEntity = extractTypeDescriptors(baseAstTypes, { include: ['Entity'] });
		expect(includeOnlyEntity.map((entry) => entry.name)).toEqual(['Entity']);

		const excludeDataType = extractTypeDescriptors(baseAstTypes, { exclude: ['DataType'] });
		expect(excludeDataType.some((entry) => entry.name === 'DataType')).toBe(false);
	});

	it('creates primitive-alias descriptor for datatype union aliases', () => {
		const descriptors = extractTypeDescriptors({
			interfaces: [
				{
					name: 'Node',
					properties: [{ name: 'id', type: 'ValidID', optional: false }]
				}
			],
			unions: [
				{
					name: 'ValidID',
					type: {
						primitive: 'string'
					}
				}
			]
		});

		expect(descriptors).toContainEqual({
			name: 'ValidID',
			kind: 'primitive-alias',
			primitive: 'string'
		});
	});

	it('does not emit fallback stubs excluded by filter config', () => {
		const descriptors = extractTypeDescriptors(
			{
				interfaces: [
					{
						name: 'Consumer',
						properties: [{ name: 'value', type: 'MissingType', optional: false }]
					}
				],
				unions: []
			},
			{ exclude: ['MissingType'] }
		);

		expect(descriptors.some((entry) => entry.name === 'MissingType')).toBe(false);
	});

	it('sets minItems=1 only for += properties with + cardinality', () => {
		const descriptors = extractTypeDescriptors({
			interfaces: [
				{
					name: 'Container',
					properties: [
						{ name: 'requiredItems', type: 'Item', assignment: '+=', cardinality: '+', optional: false },
						{ name: 'optionalItems', type: 'Item', assignment: '+=', cardinality: '*', optional: false },
						{ name: 'plainItems', type: 'Item', assignment: '+=', optional: false }
					]
				},
				{ name: 'Item', properties: [{ name: 'name', type: 'ID', optional: false }] }
			],
			unions: []
		});

		const container = descriptors.find((entry) => entry.name === 'Container' && entry.kind === 'object');
		if (!container || container.kind !== 'object') {
			throw new Error('Container descriptor not found');
		}

		expect(container.properties.find((property) => property.name === 'requiredItems')?.minItems).toBe(1);
		expect(container.properties.find((property) => property.name === 'optionalItems')?.minItems).toBeUndefined();
		expect(container.properties.find((property) => property.name === 'plainItems')?.minItems).toBeUndefined();
	});
});
