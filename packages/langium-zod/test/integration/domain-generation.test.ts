import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateDomainSchemas, generate } from '../../src/index.js';
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

describe('generate() — domain flag path', () => {
  it('writes domain.ts alongside zod-schemas.ts when emitDomain is set', async () => {
    const dir = join(tmpdir(), `langium-zod-cli-domain-${process.pid}`);
    mkdirSync(dir, { recursive: true });
    const langiumConfigPath = join(dir, 'langium-config.json');
    const grammarPath = join(dir, 'test.langium');
    writeFileSync(
      grammarPath,
      [
        'grammar Test',
        'entry Model: items+=Item*;',
        "Item: 'item' name=ID;",
        'terminal ID: /[_a-zA-Z][\\w_]*/;'
      ].join('\n'),
      'utf8'
    );
    writeFileSync(
      langiumConfigPath,
      JSON.stringify({
        projectName: 'Test',
        out: 'generated',
        languages: [{ grammar: 'test.langium' }]
      }),
      'utf8'
    );

    try {
      await generate({
        langiumConfigPath,
        config: { emitDomain: true, domainOutputPath: join(dir, 'generated', 'domain.ts') }
      });
      expect(existsSync(join(dir, 'generated', 'domain.ts'))).toBe(true);
      expect(readFileSync(join(dir, 'generated', 'domain.ts'), 'utf8')).toContain('toDomain');
      expect(existsSync(join(dir, 'generated', 'zod-schemas.ts'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
