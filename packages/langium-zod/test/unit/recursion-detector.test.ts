import { describe, expect, it } from 'vitest';
import { detectRecursiveTypes } from '../../src/recursion-detector.js';
import type { ZodTypeDescriptor } from '../../src/types.js';

describe('recursion-detector', () => {
	it('returns empty set for non-recursive descriptors', () => {
		const descriptors: ZodTypeDescriptor[] = [
			{
				name: 'Greeting',
				kind: 'object',
				properties: [
					{ name: '$type', zodType: { kind: 'literal', value: 'Greeting' }, optional: false },
					{ name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false }
				]
			}
		];

		expect(detectRecursiveTypes(descriptors).size).toBe(0);
	});

	it('detects self recursion', () => {
		const descriptors: ZodTypeDescriptor[] = [
			{
				name: 'Node',
				kind: 'object',
				properties: [
					{ name: '$type', zodType: { kind: 'literal', value: 'Node' }, optional: false },
					{
						name: 'children',
						zodType: { kind: 'array', element: { kind: 'reference', typeName: 'Node' } },
						optional: true
					}
				]
			}
		];

		expect(Array.from(detectRecursiveTypes(descriptors))).toEqual(['Node']);
	});

	it('detects mutual recursion and ignores diamond non-cycle', () => {
		const descriptors: ZodTypeDescriptor[] = [
			{
				name: 'A',
				kind: 'object',
				properties: [{ name: 'b', zodType: { kind: 'reference', typeName: 'B' }, optional: false }]
			},
			{
				name: 'B',
				kind: 'object',
				properties: [{ name: 'a', zodType: { kind: 'reference', typeName: 'A' }, optional: false }]
			},
			{
				name: 'Root',
				kind: 'object',
				properties: [
					{ name: 'left', zodType: { kind: 'reference', typeName: 'Leaf' }, optional: false },
					{ name: 'right', zodType: { kind: 'reference', typeName: 'Leaf' }, optional: false }
				]
			},
			{
				name: 'Leaf',
				kind: 'object',
				properties: [{ name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false }]
			}
		];

		const actual = detectRecursiveTypes(descriptors);
		expect(actual.has('A')).toBe(true);
		expect(actual.has('B')).toBe(true);
		expect(actual.has('Root')).toBe(false);
		expect(actual.has('Leaf')).toBe(false);
	});
});
