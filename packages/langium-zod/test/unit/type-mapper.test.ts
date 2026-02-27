import { describe, expect, it } from 'vitest';
import { mapPropertyType, mapTerminalToZod } from '../../src/type-mapper.js';

describe('type-mapper', () => {
	it('maps terminal names to primitives', () => {
		expect(mapTerminalToZod('ID')).toEqual({ kind: 'primitive', primitive: 'string' });
		expect(mapTerminalToZod('STRING')).toEqual({ kind: 'primitive', primitive: 'string' });
		expect(mapTerminalToZod('INT')).toEqual({ kind: 'primitive', primitive: 'number' });
	});

	it('maps boolean assignment for ?=', () => {
		const actual = mapPropertyType({
			name: 'active',
			assignment: '?='
		});
		expect(actual).toEqual({ kind: 'primitive', primitive: 'boolean' });
	});

	it('maps array assignment for +=', () => {
		const actual = mapPropertyType({
			name: 'tags',
			assignment: '+=',
			type: 'Tag'
		});

		expect(actual).toEqual({
			kind: 'array',
			element: { kind: 'reference', typeName: 'Tag' }
		});
	});

	it('maps cross-reference property', () => {
		const actual = mapPropertyType({
			name: 'variable',
			type: 'Variable',
			isCrossRef: true
		});

		expect(actual).toEqual({
			kind: 'crossReference',
			targetType: 'Variable'
		});
	});

	it('maps cross-reference arrays and preserves target type', () => {
		const actual = mapPropertyType({
			name: 'refs',
			assignment: '+=',
			isCrossRef: true,
			type: {
				referenceType: 'RefTarget'
			}
		});

		expect(actual).toEqual({
			kind: 'array',
			element: {
				kind: 'crossReference',
				targetType: 'RefTarget'
			}
		});
	});

	it('maps optional data-type style property to primitive', () => {
		const actual = mapPropertyType({
			name: 'description',
			type: 'string'
		});
		expect(actual).toEqual({ kind: 'primitive', primitive: 'string' });
	});
});
