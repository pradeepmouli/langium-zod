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

describe('generateNamespaceOps', () => {
  it('emits aliased import header from ast.js (no type re-export)', () => {
    const result = generateNamespaceOps([dataType, attributeType]);
    expect(result).toContain("import type {");
    expect(result).toContain("Data as Data$");
    expect(result).toContain("from './ast.js'");
    // No type re-export — import alias prevents TS2395 without it.
    expect(result).not.toContain("export type { Data }");
  });

  it('emits 6-op set for array<reference> fields', () => {
    const result = generateNamespaceOps([dataType, attributeType]);
    expect(result).toContain('export namespace Data {');
    expect(result).toContain('export function getAttributes(node: Dehydrated<Data$>): Dehydrated<Attribute$>[]');
    expect(result).toContain('export function addAttribute(node: Dehydrated<Data$>, attribute: Dehydrated<Attribute$>): void');
    expect(result).toContain('export function insertAttributeAt(node: Dehydrated<Data$>, index: number, attribute: Dehydrated<Attribute$>): void');
    expect(result).toContain('export function removeAttributeAt(node: Dehydrated<Data$>, index: number): void');
    expect(result).toContain('export function setAttributeAt(node: Dehydrated<Data$>, index: number, attribute: Dehydrated<Attribute$>): void');
    expect(result).toContain('export function moveAttributeAt(node: Dehydrated<Data$>, from: number, to: number): void');
  });

  it('emits setSuperType + clearSuperType for optional crossReference using refText: string', () => {
    const result = generateNamespaceOps([dataType, attributeType]);
    expect(result).toContain('export function setSuperType(node: Dehydrated<Data$>, refText: string): void');
    expect(result).toContain('node.superType = { $refText: refText }');
    expect(result).toContain('export function clearSuperType(node: Dehydrated<Data$>): void');
    expect(result).toContain('node.superType = undefined');
  });

  it('emits setOutput only for required single-node field', () => {
    const result = generateNamespaceOps([attributeType, rosettaFunctionRequired]);
    expect(result).toContain('export function setOutput(node: Dehydrated<RosettaFunction$>, output: Dehydrated<Attribute$>): void');
    expect(result).not.toContain('clearOutput');
  });

  it('emits setOutput + clearOutput for optional single-node field', () => {
    const result = generateNamespaceOps([attributeType, rosettaFunctionOptional]);
    expect(result).toContain('export function setOutput(node: Dehydrated<RosettaFunctionOpt$>, output: Dehydrated<Attribute$>): void');
    expect(result).toContain('export function clearOutput(node: Dehydrated<RosettaFunctionOpt$>): void');
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

  it('produces balanced braces', () => {
    const result = generateNamespaceOps([dataType, attributeType, rosettaFunctionRequired]);
    const open = (result.match(/\{/g) ?? []).length;
    const close = (result.match(/\}/g) ?? []).length;
    expect(open).toBe(close);
  });
});
