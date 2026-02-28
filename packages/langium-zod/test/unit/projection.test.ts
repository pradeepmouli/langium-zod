import { describe, expect, it, vi } from 'vitest';
import { applyProjectionToDescriptors, parseProjectionConfig } from '../../src/projection.js';
import type { ZodTypeDescriptor } from '../../src/types.js';

const descriptors: ZodTypeDescriptor[] = [
	{
		name: 'Data',
		kind: 'object',
		properties: [
			{ name: '$type', zodType: { kind: 'literal', value: 'Data' }, optional: false },
			{ name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false },
			{ name: 'superType', zodType: { kind: 'primitive', primitive: 'string' }, optional: true },
			{ name: '$container', zodType: { kind: 'primitive', primitive: 'string' }, optional: true }
		]
	}
];

describe('projection helpers', () => {
	it('parses projection config and normalizes lists', () => {
		const parsed = parseProjectionConfig({
			defaults: { strip: [' $container ', '$container'] },
			types: {
				Data: {
					fields: ['name', 'name', ' superType ']
				}
			}
		});

		expect(parsed.defaults?.strip).toEqual(['$container']);
		expect(parsed.types?.Data?.fields).toEqual(['name', 'superType']);
	});

	it('filters fields by projection and preserves $type', () => {
		const projected = applyProjectionToDescriptors(descriptors, {
			projection: {
				types: {
					Data: {
						fields: ['name']
					}
				}
			}
		});

		const objectDescriptor = projected.find((descriptor) => descriptor.kind === 'object');
		expect(objectDescriptor?.kind).toBe('object');
		if (objectDescriptor?.kind === 'object') {
			expect(objectDescriptor.properties.map((property) => property.name)).toEqual(['$type', 'name']);
		}
	});

	it('warns on unknown projection fields and strips internals', () => {
		const warn = vi.fn();
		const projected = applyProjectionToDescriptors(descriptors, {
			projection: {
				types: {
					Data: {
						fields: ['name', 'missingField']
					}
				}
			},
			stripInternals: true,
			warn
		});

		const objectDescriptor = projected.find((descriptor) => descriptor.kind === 'object');
		if (objectDescriptor?.kind === 'object') {
			expect(objectDescriptor.properties.map((property) => property.name)).toEqual(['$type', 'name']);
		}

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0]?.[0]).toContain('Unknown projection field(s) for Data: missingField');
	});
});
