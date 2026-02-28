import { describe, expect, it } from 'vitest';
import * as pkg from '../../src/index.js';

describe('package index exports', () => {
	it('exposes expected runtime exports', () => {
		expect(typeof pkg.generateZodSchemas).toBe('function');
		expect(typeof pkg.generateZodCode).toBe('function');
		expect(typeof pkg.extractTypeDescriptors).toBe('function');
		expect(typeof pkg.detectRecursiveTypes).toBe('function');
		expect(typeof pkg.generate).toBe('function');
		expect(typeof pkg.zRef).toBe('function');
		expect(typeof pkg.DefaultZodSchemaGenerator).toBe('function');
		expect(pkg.ZodSchemaGeneratorModule).toBeDefined();
	});
});
