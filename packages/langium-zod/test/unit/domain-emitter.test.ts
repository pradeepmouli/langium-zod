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
  it('emits a header and a per-object read interface, with cross-refs as DomainRef objects', () => {
    const source = generateDomainCode(flatObject);
    expect(source).toContain('// @ts-nocheck');
    expect(source).toContain('export interface DomainRef { $refText: string }');
    expect(source).toContain('export interface DataDomain {');
    expect(source).toContain('name: string;');
    expect(source).toContain('order?: number;');
    // single cross-reference surfaces as an editable DomainRef object; $type is dropped from the surface interface
    expect(source).toContain('superType?: DomainRef;');
    expect(source).not.toContain('superType?: string;');
    expect(source).not.toContain("Ref<'"); // not the branded-string form
    // $type is retained as the discriminant literal field (see $type discriminant tests below)
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
  it('emits toDomain<Name> passing cross-ref objects through and raw values otherwise', () => {
    const source = generateDomainCode(flatObject);
    expect(source).toContain('export function toDomainData(node: any): DataDomain {');
    expect(source).toContain('name: node.name,');
    expect(source).toContain('order: node.order,');
    // cross-ref is normalised to a plain DomainRef on read (strips Langium runtime `ref` pointer)
    expect(source).toContain('superType: node.superType ? { $refText: node.superType.$refText } : undefined,');
  });
});

const arrayObject: ZodTypeDescriptor[] = [
  {
    name: 'Attribute',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Attribute' }, optional: false },
      { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false }
    ]
  },
  {
    name: 'Func',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Func' }, optional: false },
      { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false },
      { name: 'output', zodType: { kind: 'crossReference', targetType: 'Data' }, optional: true },
      {
        name: 'inputs',
        zodType: { kind: 'array', element: { kind: 'reference', typeName: 'Attribute' } },
        optional: false
      },
      {
        name: 'tags',
        zodType: { kind: 'array', element: { kind: 'primitive', primitive: 'string' } },
        optional: false
      }
    ]
  }
];

describe('generateDomainCode — write accessors', () => {
  it('emits set for scalars, $refText-mutating set for cross-refs, add/remove for arrays', () => {
    const source = generateDomainCode(arrayObject);
    expect(source).toContain('export function setFuncName(node: any, value: string): void {');
    expect(source).toContain('  node.name = value;');
    expect(source).toContain('export function setFuncOutput(node: any, value: string): void {');
    expect(source).toContain('  if (node.output) node.output.$refText = value;');
    expect(source).toContain('  else node.output = { $refText: value };');
    expect(source).toContain('export function addFuncInputs(node: any, item: unknown): void {');
    expect(source).toContain('  (node.inputs ??= []).push(item);');
    expect(source).toContain('export function removeFuncInputsAt(node: any, index: number): void {');
    expect(source).toContain('  node.inputs?.splice(index, 1);');
    expect(source).toContain('export function addFuncTags(node: any, item: string): void {');
  });
});

const nestedObject: ZodTypeDescriptor[] = [
  {
    name: 'Attribute',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Attribute' }, optional: false },
      { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false }
    ]
  },
  {
    name: 'Data',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Data' }, optional: false },
      { name: 'header', zodType: { kind: 'reference', typeName: 'Attribute' }, optional: true },
      {
        name: 'attributes',
        zodType: { kind: 'array', element: { kind: 'reference', typeName: 'Attribute' } },
        optional: false
      }
    ]
  }
];

describe('generateDomainCode — nested references', () => {
  it('types nested refs as <Name>Domain and recurses in the read projection', () => {
    const source = generateDomainCode(nestedObject);
    expect(source).toContain('header?: AttributeDomain;');
    expect(source).toContain('attributes: AttributeDomain[];');
    expect(source).toContain('header: node.header ? toDomainAttribute(node.header) : undefined,');
    expect(source).toContain(
      'attributes: (node.attributes ?? []).map((item) => item ? toDomainAttribute(item) : undefined),'
    );
  });
});

const withUnion: ZodTypeDescriptor[] = [
  {
    name: 'Literal',
    kind: 'object',
    properties: [{ name: '$type', zodType: { kind: 'literal', value: 'Literal' }, optional: false }]
  },
  {
    name: 'BinaryExpr',
    kind: 'object',
    properties: [{ name: '$type', zodType: { kind: 'literal', value: 'BinaryExpr' }, optional: false }]
  },
  { name: 'Expression', kind: 'union', members: ['Literal', 'BinaryExpr'], discriminator: '$type' }
];

describe('generateDomainCode — unions', () => {
  it('emits a domain type alias + a $type dispatcher for grammar unions', () => {
    const source = generateDomainCode(withUnion);
    expect(source).toContain('export type ExpressionDomain = LiteralDomain | BinaryExprDomain;');
    expect(source).toContain('export function toDomainExpression(node: any): ExpressionDomain {');
    expect(source).toContain('case "Literal": return toDomainLiteral(node);');
    expect(source).toContain('case "BinaryExpr": return toDomainBinaryExpr(node);');
  });
});

describe('generateDomainCode — master dispatcher', () => {
  it('emits AnyDomain and a toDomain(node) switch over all objects', () => {
    const source = generateDomainCode(nestedObject); // Attribute + Data from Task 4
    expect(source).toContain('export type AnyDomain = AttributeDomain | DataDomain;');
    expect(source).toContain('export function toDomain(node: any): AnyDomain {');
    expect(source).toContain('case "Attribute": return toDomainAttribute(node);');
    expect(source).toContain('case "Data": return toDomainData(node);');
  });
});

const renameObject: ZodTypeDescriptor[] = [
  {
    name: 'Attribute',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Attribute' }, optional: false },
      { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false }
    ]
  },
  {
    name: 'Choice',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Choice' }, optional: false },
      {
        name: 'attributes',
        zodType: { kind: 'array', element: { kind: 'reference', typeName: 'Attribute' } },
        optional: false
      }
    ]
  }
];

describe('generateDomainCode — renames', () => {
  it('renames the domain field + accessors but reads/writes the source field', () => {
    const source = generateDomainCode(renameObject, {
      overlays: { types: { Choice: { renames: { attributes: 'options' } } } }
    });
    expect(source).toContain('options: AttributeDomain[];');
    expect(source).toContain('options: (node.attributes ?? []).map((item) =>');
    expect(source).toContain('export function addChoiceOptions(node: any, item: unknown): void {');
    expect(source).toContain('  (node.attributes ??= []).push(item);');
    expect(source).not.toContain('addChoiceAttributes');
  });

  it('toAst reads the renamed value from the domain key and restores the source field (round-trip)', () => {
    const source = generateDomainCode(renameObject, {
      overlays: { types: { Choice: { renames: { attributes: 'options' } } } }
    });
    // toAstChoice emits the AST source key `attributes`, but must READ from the domain
    // surface key `options` (where toDomainChoice stored the value). Reading the AST key
    // here would see `undefined` and silently zero the field on every round-trip.
    const toAstStart = source.indexOf('export function toAstChoice(node: any): any {');
    const toAstEnd = source.indexOf('\n}', toAstStart) + 2;
    const toAstBody = source.slice(toAstStart, toAstEnd);
    expect(toAstBody).toContain('attributes: (node.options ?? []).map((item) =>');
    // The AST source key must NOT be read back — that path sees `undefined` and zeroes
    // the field. (The emitted PROPERTY is still `attributes:`, the grammar key; only the
    // read access changes to the domain key `node.options`.)
    expect(toAstBody).not.toContain('node.attributes');
  });
});

const mergeObject: ZodTypeDescriptor[] = [
  {
    name: 'Condition',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Condition' }, optional: false },
      { name: 'expression', zodType: { kind: 'primitive', primitive: 'string' }, optional: false }
    ]
  },
  {
    name: 'RosettaFunction',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'RosettaFunction' }, optional: false },
      {
        name: 'conditions',
        zodType: { kind: 'array', element: { kind: 'reference', typeName: 'Condition' } },
        optional: false
      },
      {
        name: 'postConditions',
        zodType: { kind: 'array', element: { kind: 'reference', typeName: 'Condition' } },
        optional: false
      }
    ]
  }
];

describe('generateDomainCode — merges', () => {
  it('emits one merged read field concatenating sources, with no merged setter', () => {
    const source = generateDomainCode(mergeObject, {
      overlays: {
        types: {
          RosettaFunction: {
            merges: [{ from: ['conditions', 'postConditions'], to: 'conditions' }]
          }
        }
      }
    });
    // single merged read field, type from the first source's element
    expect(source).toContain('conditions: ConditionDomain[];');
    expect(source).toContain(
      'conditions: [...(node.conditions ?? []).map((item) => item ? toDomainCondition(item) : undefined), ...(node.postConditions ?? []).map((item) => item ? toDomainCondition(item) : undefined)],'
    );
    // write accessors stay source-keyed, distinct, no merged setter
    expect(source).toContain('export function addRosettaFunctionConditions(node: any, item: unknown): void {');
    expect(source).toContain('  (node.conditions ??= []).push(item);');
    expect(source).toContain('export function addRosettaFunctionPostConditions(node: any, item: unknown): void {');
    expect(source).toContain('  (node.postConditions ??= []).push(item);');
  });

  it('toAst does NOT write back a merge-target field (merges are not round-trippable; documented limitation)', () => {
    const source = generateDomainCode(mergeObject, {
      overlays: {
        types: {
          RosettaFunction: {
            merges: [{ from: ['conditions', 'postConditions'], to: 'conditions' }]
          }
        }
      }
    });
    // toDomain reads the merged field (sanity: the merge read projection still emits).
    expect(source).toContain('export function toDomainRosettaFunction(node: any): RosettaFunctionDomain {');
    expect(source).toContain('conditions: [...(node.conditions ?? []).map');
    // toAst exists for the type...
    expect(source).toContain('export function toAstRosettaFunction(node: any): any {');
    // ...but a merge cannot be inverted (the split point between source arrays is lost),
    // so the merged target field is absent from toAstRosettaFunction. Pin that drop:
    // neither the merge-target read-back nor the source-array buckets appear in toAst.
    const toAstStart = source.indexOf('export function toAstRosettaFunction(node: any): any {');
    const toAstEnd = source.indexOf('\n}', toAstStart) + 2;
    const toAstBody = source.slice(toAstStart, toAstEnd);
    expect(toAstBody).not.toContain('conditions:');
    expect(toAstBody).not.toContain('postConditions:');
  });
});

describe('generateDomainCode — merge validation', () => {
  const fnWith = (props: any[]): ZodTypeDescriptor[] => [
    {
      name: 'F',
      kind: 'object',
      properties: [{ name: '$type', zodType: { kind: 'literal', value: 'F' }, optional: false }, ...props]
    }
  ];
  const arr = (name: string) => ({
    name,
    zodType: { kind: 'array', element: { kind: 'primitive', primitive: 'string' } },
    optional: false
  });

  it('throws when a merge source does not exist', () => {
    expect(() =>
      generateDomainCode(fnWith([arr('a')]), {
        overlays: { types: { F: { merges: [{ from: ['a', 'missing'], to: 'a' }] } } }
      })
    ).toThrow(/source field "missing" does not exist/);
  });

  it('throws when a merge source is not an array', () => {
    expect(() =>
      generateDomainCode(
        fnWith([arr('a'), { name: 'b', zodType: { kind: 'primitive', primitive: 'string' }, optional: false }]),
        { overlays: { types: { F: { merges: [{ from: ['a', 'b'], to: 'a' }] } } } }
      )
    ).toThrow(/is not an array/);
  });

  it('throws when the merge target collides with a non-source field', () => {
    expect(() =>
      generateDomainCode(
        fnWith([arr('a'), arr('b'), { name: 'c', zodType: { kind: 'primitive', primitive: 'string' }, optional: false }]),
        { overlays: { types: { F: { merges: [{ from: ['a', 'b'], to: 'c' }] } } } }
      )
    ).toThrow(/collides with an existing non-source field/);
  });
});

const sharedFieldName: ZodTypeDescriptor[] = [
  {
    name: 'Attribute',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Attribute' }, optional: false },
      { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false }
    ]
  },
  {
    name: 'Data',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Data' }, optional: false },
      { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false }
    ]
  }
];

describe('generateDomainCode — accessor name collisions', () => {
  it('qualifies accessor names by owner type so shared field names do not collide', () => {
    const source = generateDomainCode(sharedFieldName);
    expect(source).toContain('export function setAttributeName(');
    expect(source).toContain('export function setDataName(');
    // No duplicate top-level export identifier (the SyntaxError-at-import guard).
    const fnNames = [...source.matchAll(/export function (\w+)\(/g)].map((match) => match[1]);
    const duplicates = fnNames.filter((name, index) => fnNames.indexOf(name) !== index);
    expect(duplicates).toEqual([]);
  });
});

// Fix 1: references to datatype-rule / keyword-enum descriptors must NOT emit
// toDomain<X> / <X>Domain — they resolve to their underlying primitive type.
const datatypeRefDescriptors: ZodTypeDescriptor[] = [
  {
    name: 'ValidID',
    kind: 'primitive-alias',
    primitive: 'string'
  },
  {
    name: 'Model',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Model' }, optional: false },
      // id references a primitive-alias datatype rule, NOT a rich object type
      { name: 'id', zodType: { kind: 'reference', typeName: 'ValidID' }, optional: false }
    ]
  }
];

describe('generateDomainCode — datatype-rule reference passthrough', () => {
  it('resolves primitive-alias references to their primitive type, not to <X>Domain', () => {
    const source = generateDomainCode(datatypeRefDescriptors);
    // Interface field must be the primitive type, not ValidIDDomain
    expect(source).toContain('id: string;');
    expect(source).not.toContain('id: ValidIDDomain;');
    // Read projection must be an identity read, not toDomainValidID(...)
    expect(source).toContain('id: node.id,');
    expect(source).not.toContain('toDomainValidID');
    // Write accessor must be a primitive setter, not a cross-ref or missing
    expect(source).toContain('export function setModelId(node: any, value: string): void {');
    expect(source).toContain('  node.id = value;');
  });

  it('resolves keyword-enum references to string, not to <X>Domain', () => {
    const descriptors: ZodTypeDescriptor[] = [
      { name: 'Status', kind: 'keyword-enum', keywords: ['active', 'inactive'] },
      {
        name: 'Item',
        kind: 'object',
        properties: [
          { name: '$type', zodType: { kind: 'literal', value: 'Item' }, optional: false },
          { name: 'status', zodType: { kind: 'reference', typeName: 'Status' }, optional: true }
        ]
      }
    ];
    const source = generateDomainCode(descriptors);
    expect(source).toContain('status?: string;');
    expect(source).not.toContain('StatusDomain');
    expect(source).toContain('status: node.status,');
    expect(source).not.toContain('toDomainStatus');
  });
});

describe('generateDomainCode — lossless surface (strip $-internals only)', () => {
  const lossyDescriptor: ZodTypeDescriptor[] = [
    {
      name: 'Attribute',
      kind: 'object',
      properties: [
        { name: '$type', zodType: { kind: 'literal', value: 'Attribute' }, optional: false },
        { name: '$container', zodType: { kind: 'primitive', primitive: 'string' }, optional: true },
        { name: '$cstNode', zodType: { kind: 'primitive', primitive: 'string' }, optional: true },
        { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false },
        { name: 'references', zodType: { kind: 'array', element: { kind: 'primitive', primitive: 'string' } }, optional: true },
        { name: 'labels', zodType: { kind: 'array', element: { kind: 'primitive', primitive: 'string' } }, optional: true },
        { name: 'ruleReferences', zodType: { kind: 'array', element: { kind: 'primitive', primitive: 'string' } }, optional: true },
        { name: 'typeCallArgs', zodType: { kind: 'array', element: { kind: 'primitive', primitive: 'string' } }, optional: true },
        { name: 'enumSynonyms', zodType: { kind: 'array', element: { kind: 'primitive', primitive: 'string' } }, optional: true }
      ]
    }
  ];

  it('keeps references/labels/ruleReferences/typeCallArgs/enumSynonyms and strips $-internals', () => {
    const source = generateDomainCode(lossyDescriptor, { stripInternals: true });
    for (const field of ['references', 'labels', 'ruleReferences', 'typeCallArgs', 'enumSynonyms']) {
      expect(source).toContain(`${field}?: string[];`);
    }
    expect(source).not.toContain('$container');
    expect(source).not.toContain('$cstNode');
  });
});

describe('generateDomainCode — $type discriminant retention', () => {
  it('keeps $type as a literal interface field and reads node.$type', () => {
    const source = generateDomainCode(flatObject);
    expect(source).toContain("$type: 'Data';");
    expect(source).toContain('$type: node.$type,');
    // No setter is emitted for $type (it is the discriminant, not an editable field).
    expect(source).not.toContain('export function setDataType');
    expect(source).not.toContain('export function set$type');
  });

  it('emits AnyDomain as a union and a $type-dispatched toDomain', () => {
    const source = generateDomainCode([
      ...flatObject,
      {
        name: 'Choice',
        kind: 'object',
        properties: [
          { name: '$type', zodType: { kind: 'literal', value: 'Choice' }, optional: false },
          { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false }
        ]
      }
    ]);
    expect(source).toContain('export type AnyDomain = DataDomain | ChoiceDomain;');
    expect(source).toContain('export function toDomain(node: any): AnyDomain {');
    expect(source).toContain('case "Data": return toDomainData(node);');
  });
});

describe('generateDomainCode — additive normalizations', () => {
  const dataDesc: ZodTypeDescriptor[] = [
    {
      name: 'Data',
      kind: 'object',
      properties: [
        { name: '$type', zodType: { kind: 'literal', value: 'Data' }, optional: false },
        { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false },
        { name: 'superType', zodType: { kind: 'crossReference', targetType: 'Data' }, optional: true },
        { name: 'attributes', zodType: { kind: 'array', element: { kind: 'primitive', primitive: 'string' } }, optional: true }
      ]
    }
  ];

  it('appends extends/members aliases reusing the source field projected type + readExpr', () => {
    const source = generateDomainCode(dataDesc, {
      normalizations: {
        inheritance: { as: 'extends', from: { Data: 'superType' } },
        members: { as: 'members', from: { Data: 'attributes' } }
      }
    });
    // Source fields retained.
    expect(source).toContain('superType?: DomainRef;');
    expect(source).toContain('attributes?: string[];');
    // Aliases reuse the SOURCE projected type (DomainRef object, not branded/string).
    expect(source).toContain('extends?: DomainRef;');
    expect(source).toContain('members?: string[];');
    // Aliases reuse the SOURCE readExpr verbatim (normalised DomainRef for the ref).
    expect(source).toContain('extends: node.superType ? { $refText: node.superType.$refText } : undefined,');
    expect(source).toContain('members: (node.attributes ?? []).map((item) => item),');
    // No write accessor for an alias (writes go through the source field's accessor).
    expect(source).not.toContain('export function setDataExtends');
    expect(source).not.toContain('export function addDataMembers');
  });

  it('throws when a normalization `as` collides with an existing field', () => {
    expect(() =>
      generateDomainCode(dataDesc, {
        normalizations: { dup: { as: 'name', from: { Data: 'superType' } } }
      })
    ).toThrow(/normalization "name" for Data: target collides/);
  });

  it('silently skips a kind whose source field is absent', () => {
    const source = generateDomainCode(dataDesc, {
      normalizations: { inheritance: { as: 'extends', from: { Choice: 'superType' } } }
    });
    expect(source).not.toContain('extends');
  });
});

describe('generateDomainCode — toAst inverse', () => {
  const desc: ZodTypeDescriptor[] = [
    {
      name: 'Data',
      kind: 'object',
      properties: [
        { name: '$type', zodType: { kind: 'literal', value: 'Data' }, optional: false },
        { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false },
        { name: 'superType', zodType: { kind: 'crossReference', targetType: 'Data' }, optional: true },
        { name: 'attributes', zodType: { kind: 'array', element: { kind: 'reference', typeName: 'Attribute' } }, optional: true }
      ]
    },
    {
      name: 'Attribute',
      kind: 'object',
      properties: [
        { name: '$type', zodType: { kind: 'literal', value: 'Attribute' }, optional: false },
        { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false }
      ]
    }
  ];

  it('emits per-object toAstX, a master toAst dispatch, and drops normalization aliases', () => {
    const source = generateDomainCode(desc, {
      normalizations: { inheritance: { as: 'extends', from: { Data: 'superType' } } }
    });
    expect(source).toContain('export function toAstData(node: any): any {');
    expect(source).toContain("$type: 'Data',");
    expect(source).toContain('name: node.name,');
    // Ref object passes straight through.
    expect(source).toContain('superType: node.superType,');
    // Rich-child arrays recurse via toAst<Child>.
    expect(source).toContain('attributes: (node.attributes ?? []).map((item) => item ? toAstAttribute(item) : undefined),');
    // The `extends` alias is NOT written back to the AST (toAstData must not contain it).
    // Note: toDomainData legitimately emits the alias read, so we check the toAst function specifically.
    const toAstDataStart = source.indexOf('export function toAstData(node: any): any {');
    const toAstDataEnd = source.indexOf('\n}', toAstDataStart) + 2;
    const toAstDataBody = source.slice(toAstDataStart, toAstDataEnd);
    expect(toAstDataBody).not.toContain('extends:');
    // Master dispatch.
    expect(source).toContain('export function toAst(node: any): any {');
    expect(source).toContain(`case "Data": return toAstData(node);`);
  });
});
