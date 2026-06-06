import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateDomainSchemas } from '../../src/index.js';
import type { AstTypesLike } from '../../src/types.js';

const astTypes: AstTypesLike = {
  interfaces: [
    { name: 'Attribute', properties: [{ name: 'name', type: 'ID', optional: false }] },
    {
      name: 'Data',
      properties: [
        { name: 'name', type: 'ID', optional: false },
        { name: 'attributes', type: 'Attribute', assignment: '+=', optional: false }
      ]
    }
  ],
  unions: []
};

describe('generateDomainSchemas (integration)', () => {
  it('returns domain source and writes it when domainOutputPath is set', () => {
    const outDir = join(tmpdir(), `langium-zod-domain-${process.pid}`);
    mkdirSync(outDir, { recursive: true });
    const domainOutputPath = join(outDir, 'domain.ts');

    try {
      const source = generateDomainSchemas({
        astTypes,
        domainOutputPath,
        stripInternals: true
      });

      expect(source).toContain('export interface DataDomain {');
      expect(source).toContain('attributes: AttributeDomain[];');
      expect(source).toContain('export function toDomain(node: any): AnyDomain {');
      expect(existsSync(domainOutputPath)).toBe(true);
      expect(readFileSync(domainOutputPath, 'utf8')).toBe(source);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
