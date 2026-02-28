import { describe, expect, it } from 'vitest';
import { normalizeFilterConfig } from '../../src/config.js';

describe('config helpers', () => {
	it('normalizes undefined filter config to empty arrays', () => {
		expect(normalizeFilterConfig()).toEqual({
			include: [],
			exclude: []
		});
	});

	it('preserves configured include/exclude arrays', () => {
		expect(normalizeFilterConfig({ include: ['A'], exclude: ['B'] })).toEqual({
			include: ['A'],
			exclude: ['B']
		});
	});
});
