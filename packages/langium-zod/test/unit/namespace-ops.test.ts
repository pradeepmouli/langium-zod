// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import type { ZodTypeDescriptor } from '../../src/types.js';
import { generateNamespaceOps } from '../../src/emitters/namespace-ops.js';

// Minimal Attribute descriptor — needed in objectTypeNames so reference fields aren't skipped.
const attributeType: ZodTypeDescriptor = {
  name: 'Attribute',
  kind: 'object',
  properties: [
    { name: '$type', zodType: { kind: 'literal', value: 'Attribute' }, optional: false },
  ],
};

const dataType: ZodTypeDescriptor = {
  name: 'Data',
  kind: 'object',
  properties: [
    { name: '$type', zodType: { kind: 'literal', value: 'Data' }, optional: false },
    { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false },
    {
      name: 'attributes',
      zodType: { kind: 'array', element: { kind: 'reference', typeName: 'Attribute' } },
      optional: false,
    },
    {
      name: 'superType',
      zodType: { kind: 'crossReference', targetType: 'Data' },
      optional: true,
    },
  ],
};

const rosettaFunctionRequired: ZodTypeDescriptor = {
  name: 'RosettaFunction',
  kind: 'object',
  properties: [
    { name: '$type', zodType: { kind: 'literal', value: 'RosettaFunction' }, optional: false },
    {
      name: 'output',
      zodType: { kind: 'reference', typeName: 'Attribute' },
      optional: false,
    },
  ],
};

const rosettaFunctionOptional: ZodTypeDescriptor = {
  name: 'RosettaFunctionOpt',
  kind: 'object',
  properties: [
    { name: '$type', zodType: { kind: 'literal', value: 'RosettaFunctionOpt' }, optional: false },
    {
      name: 'output',
      zodType: { kind: 'reference', typeName: 'Attribute' },
      optional: true,
    },
  ],
};

const choiceOptionType: ZodTypeDescriptor = {
  name: 'ChoiceOption',
  kind: 'object',
  properties: [
    { name: '$type', zodType: { kind: 'literal', value: 'ChoiceOption' }, optional: false },
    { name: 'typeCall', zodType: { kind: 'reference', typeName: 'TypeCall' }, optional: false },
  ],
};
const choiceType: ZodTypeDescriptor = {
  name: 'Choice',
  kind: 'object',
  properties: [
    { name: '$type', zodType: { kind: 'literal', value: 'Choice' }, optional: false },
    { name: 'attributes', zodType: { kind: 'array', element: { kind: 'reference', typeName: 'ChoiceOption' } }, optional: false },
  ],
};

describe('generateNamespaceOps', () => {
  it('emits a single-barrel header: namespace import + star re-export from ast.js', () => {
    const result = generateNamespaceOps([dataType, attributeType]);
    expect(result).toContain("import * as ast from './ast.js'");
    expect(result).toContain("export * from './ast.js'");
    // No `$`-suffixed aliased imports — the namespace import binding is used instead.
    expect(result).not.toContain('Data as Data$');
  });

  it('emits a type alias re-export for each namespaced type so the name is both type + ops', () => {
    const result = generateNamespaceOps([dataType, attributeType]);
    // Data gets a namespace, so it needs a local `export type Data = ast.Data` to keep
    // the merged name usable as a type (the namespace shadows the star-exported interface).
    expect(result).toContain('export type Data = ast.Data;');
    // Attribute has no actionable fields → no namespace → no type alias (flows via export *).
    expect(result).not.toContain('export type Attribute = ast.Attribute;');
  });

  it('emits 6-op set for array<reference> fields, qualified through the ast binding', () => {
    const result = generateNamespaceOps([dataType, attributeType]);
    expect(result).toContain('export namespace Data {');
    expect(result).toContain('export function getAttributes(node: Dehydrated<ast.Data>): Dehydrated<ast.Attribute>[]');
    expect(result).toContain('export function addAttribute(node: Dehydrated<ast.Data>, attribute: Dehydrated<ast.Attribute>): void');
    expect(result).toContain('export function insertAttributeAt(node: Dehydrated<ast.Data>, index: number, attribute: Dehydrated<ast.Attribute>): void');
    expect(result).toContain('export function removeAttributeAt(node: Dehydrated<ast.Data>, index: number): void');
    expect(result).toContain('export function setAttributeAt(node: Dehydrated<ast.Data>, index: number, attribute: Dehydrated<ast.Attribute>): void');
    expect(result).toContain('export function moveAttributeAt(node: Dehydrated<ast.Data>, from: number, to: number): void');
  });

  it('moveXAt guards an out-of-range `from` index (no-op, not a splice-from-end)', () => {
    const result = generateNamespaceOps([dataType, attributeType]);
    // Without the guard, splice(from, 1) with a negative `from` removes from the
    // END (corrupting order) instead of being a no-op. The guard matches the
    // consumer's reorderInPlace contract: out-of-range from → return early.
    expect(result).toContain('if (from < 0 || from >= node.attributes.length) return;');
  });

  it('emits setSuperType + clearSuperType for optional crossReference using refText: string', () => {
    const result = generateNamespaceOps([dataType, attributeType]);
    expect(result).toContain('export function setSuperType(node: Dehydrated<ast.Data>, refText: string): void');
    expect(result).toContain('node.superType = { $refText: refText }');
    expect(result).toContain('export function clearSuperType(node: Dehydrated<ast.Data>): void');
    expect(result).toContain('node.superType = undefined');
  });

  it('emits setOutput only for required single-node field', () => {
    const result = generateNamespaceOps([attributeType, rosettaFunctionRequired]);
    expect(result).toContain('export function setOutput(node: Dehydrated<ast.RosettaFunction>, output: Dehydrated<ast.Attribute>): void');
    expect(result).not.toContain('clearOutput');
  });

  it('emits setOutput + clearOutput for optional single-node field', () => {
    const result = generateNamespaceOps([attributeType, rosettaFunctionOptional]);
    expect(result).toContain('export function setOutput(node: Dehydrated<ast.RosettaFunctionOpt>, output: Dehydrated<ast.Attribute>): void');
    expect(result).toContain('export function clearOutput(node: Dehydrated<ast.RosettaFunctionOpt>): void');
    expect(result).toContain('node.output = undefined');
  });

  it('skips primitive and literal fields', () => {
    const result = generateNamespaceOps([dataType, attributeType]);
    expect(result).not.toContain('getName');
    expect(result).not.toContain('setName');
  });

  it('skips types with no actionable fields', () => {
    const primitiveOnly: ZodTypeDescriptor = {
      name: 'ValidID',
      kind: 'object',
      properties: [
        { name: '$type', zodType: { kind: 'literal', value: 'ValidID' }, optional: false },
        { name: 'value', zodType: { kind: 'primitive', primitive: 'string' }, optional: false },
      ],
    };
    const result = generateNamespaceOps([primitiveOnly]);
    expect(result).not.toContain('export namespace ValidID');
  });

  it('emits removeX matching by single-segment identity path when configured', () => {
    const result = generateNamespaceOps([dataType, attributeType], { identity: { Attribute: 'name' } });
    expect(result).toContain('export function removeAttribute(node: Dehydrated<ast.Data>, attribute: Dehydrated<ast.Attribute>): boolean {');
    expect(result).toContain('const __k = attribute.name;');
    expect(result).toContain('const __i = node.attributes.findIndex((e) => e.name === __k);');
    expect(result).toContain('if (__i < 0) return false;');
    expect(result).toContain('node.attributes.splice(__i, 1);');
    expect(result).toContain('return true;');
  });

  it('emits no removeX when the element type is absent from identity config', () => {
    const result = generateNamespaceOps([dataType, attributeType]);
    expect(result).not.toContain('export function removeAttribute(');
    const withEmpty = generateNamespaceOps([dataType, attributeType], { identity: {} });
    expect(withEmpty).not.toContain('export function removeAttribute(');
  });

  it('emits removeX with optional-chained access for nested identity paths', () => {
    const result = generateNamespaceOps([choiceType, choiceOptionType], {
      identity: { ChoiceOption: 'typeCall.type.$refText' },
    });
    expect(result).toContain('export function removeAttribute(node: Dehydrated<ast.Choice>, attribute: Dehydrated<ast.ChoiceOption>): boolean {');
    expect(result).toContain('const __k = attribute.typeCall?.type?.$refText;');
    expect(result).toContain('const __i = node.attributes.findIndex((e) => e.typeCall?.type?.$refText === __k);');
  });

  it('produces balanced braces', () => {
    const result = generateNamespaceOps([dataType, attributeType, rosettaFunctionRequired]);
    const open = (result.match(/\{/g) ?? []).length;
    const close = (result.match(/\}/g) ?? []).length;
    expect(open).toBe(close);
  });
});

describe('repository emission', () => {
  it('emits the generic Repository<T> primitive + createRepository with throw-on-dup', () => {
    const source = generateNamespaceOps([dataType, attributeType], {
      repository: { elementTypes: ['Data'] },
    });
    expect(source).toContain('export interface Repository<T> {');
    expect(source).toContain('byId(id: string): T | undefined;');
    expect(source).toContain('byType<K extends string>(type: K): readonly T[];');
    expect(source).toContain('all(): readonly T[];');
    expect(source).toContain('export function createRepository<T>(');
    expect(source).toContain('if (byIdMap.has(k)) throw new DuplicateKeyError(k);');
    expect(source).toContain('export class DuplicateKeyError extends Error {');
    // The repository-emitting path must stay brace-balanced (the no-options
    // balanced-braces test never exercises it).
    const open = (source.match(/\{/g) ?? []).length;
    const close = (source.match(/\}/g) ?? []).length;
    expect(open).toBe(close);
  });

  it('emits NOTHING repository-shaped when elementTypes is absent', () => {
    const source = generateNamespaceOps([dataType, attributeType]);
    expect(source).not.toContain('export interface Repository<T>');
    expect(source).not.toContain('createRepository');
  });
});
