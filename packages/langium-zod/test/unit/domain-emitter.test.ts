import { describe, expect, it } from 'vitest';
import { generateDomainCode } from '../../src/emitters/domain.js';
import type { ZodTypeDescriptor } from '../../src/types.js';

const flatObject: ZodTypeDescriptor[] = [
  {
    name: 'Data',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Data' }, optional: false },
      { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false },
      { name: 'order', zodType: { kind: 'primitive', primitive: 'number' }, optional: true },
      { name: 'superType', zodType: { kind: 'crossReference', targetType: 'Data' }, optional: true }
    ]
  }
];

describe('generateDomainCode — flat interfaces', () => {
  it('emits a header and a per-object read interface, flattening cross-refs to string', () => {
    const source = generateDomainCode(flatObject);
    expect(source).toContain('// @ts-nocheck');
    expect(source).toContain('export interface DataDomain {');
    expect(source).toContain('name: string;');
    expect(source).toContain('order?: number;');
    // single cross-reference flattens to a string ($refText); $type is dropped from the surface
    expect(source).toContain('superType?: string;');
    expect(source).not.toContain('$type');
  });

  it('parenthesizes a union when it is an array element', () => {
    const descriptors: ZodTypeDescriptor[] = [
      {
        name: 'Holder',
        kind: 'object',
        properties: [
          { name: '$type', zodType: { kind: 'literal', value: 'Holder' }, optional: false },
          {
            name: 'items',
            zodType: {
              kind: 'array',
              element: {
                kind: 'union',
                members: [
                  { kind: 'primitive', primitive: 'string' },
                  { kind: 'primitive', primitive: 'number' }
                ]
              }
            },
            optional: false
          }
        ]
      }
    ];
    const source = generateDomainCode(descriptors);
    expect(source).toContain('items: (string | number)[];');
  });
});

describe('generateDomainCode — read projection', () => {
  it('emits toDomain<Name> reading $refText for cross-refs and raw values otherwise', () => {
    const source = generateDomainCode(flatObject);
    expect(source).toContain('export function toDomainData(node: any): DataDomain {');
    expect(source).toContain('name: node.name,');
    expect(source).toContain('order: node.order,');
    expect(source).toContain('superType: node.superType?.$refText,');
  });
});
