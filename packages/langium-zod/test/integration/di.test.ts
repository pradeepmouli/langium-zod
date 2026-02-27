import { describe, expect, it } from 'vitest';
import { DefaultZodSchemaGenerator, ZodSchemaGeneratorModule } from '../../src/di.js';
import { zRef } from '../../src/index.js';

describe('di integration', () => {
	it('exposes module registration and generator service shape', () => {
		expect(ZodSchemaGeneratorModule.shared).toBeDefined();
		expect(typeof ZodSchemaGeneratorModule.shared.ZodSchemaGenerator).toBe('function');
	});

	it('creates generator service instance', () => {
		const service = new DefaultZodSchemaGenerator({} as never);
		expect(typeof service.generate).toBe('function');
	});

	it('exports zRef utility from package entrypoint', () => {
		expect(typeof zRef).toBe('function');
	});
});
