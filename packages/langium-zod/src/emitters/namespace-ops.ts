// SPDX-License-Identifier: MIT
import type { ZodObjectTypeDescriptor, ZodTypeDescriptor, ZodTypeExpression } from '../types.js';

type FieldKind =
  | { tag: 'array'; fieldName: string; elementType: string }
  | { tag: 'singleNode'; fieldName: string; typeName: string; optional: boolean }
  | { tag: 'crossRef'; fieldName: string; targetType: string; optional: boolean }
  | { tag: 'skip' };

function classifyField(
  fieldName: string,
  zodType: ZodTypeExpression,
  optional: boolean
): FieldKind {
  if (zodType.kind === 'array') {
    const el = zodType.element;
    if (el.kind === 'reference') {
      return { tag: 'array', fieldName, elementType: el.typeName };
    }
    return { tag: 'skip' };
  }
  if (zodType.kind === 'reference') {
    return { tag: 'singleNode', fieldName, typeName: zodType.typeName, optional };
  }
  if (zodType.kind === 'crossReference') {
    return { tag: 'crossRef', fieldName, targetType: zodType.targetType, optional };
  }
  return { tag: 'skip' };
}

/** Strip trailing 's' for simple pluralization inversion. e.g. 'attributes' → 'attribute' */
function singularize(name: string): string {
  return name.endsWith('s') ? name.slice(0, -1) : name;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : `${s[0]!.toUpperCase()}${s.slice(1)}`;
}

function emitArrayOps(typeName: string, field: Extract<FieldKind, { tag: 'array' }>): string {
  const { fieldName, elementType } = field;
  const singular = singularize(fieldName);
  const Singular = capitalize(singular);
  const Field = capitalize(fieldName);
  const lines: string[] = [
    `  export function get${Field}(node: Dehydrated<${typeName}>): Dehydrated<${elementType}>[] {`,
    `    return node.${fieldName};`,
    `  }`,
    `  export function add${Singular}(node: Dehydrated<${typeName}>, ${singular}: Dehydrated<${elementType}>): void {`,
    `    node.${fieldName}.push(${singular});`,
    `  }`,
    `  export function insert${Singular}At(node: Dehydrated<${typeName}>, index: number, ${singular}: Dehydrated<${elementType}>): void {`,
    `    node.${fieldName}.splice(index, 0, ${singular});`,
    `  }`,
    `  export function remove${Singular}At(node: Dehydrated<${typeName}>, index: number): void {`,
    `    node.${fieldName}.splice(index, 1);`,
    `  }`,
    `  export function set${Singular}At(node: Dehydrated<${typeName}>, index: number, ${singular}: Dehydrated<${elementType}>): void {`,
    `    node.${fieldName}[index] = ${singular};`,
    `  }`,
    `  export function move${Singular}At(node: Dehydrated<${typeName}>, from: number, to: number): void {`,
    `    const [item] = node.${fieldName}.splice(from, 1);`,
    `    node.${fieldName}.splice(to, 0, item!);`,
    `  }`,
  ];
  return lines.join('\n');
}

function emitSingleNodeOps(
  typeName: string,
  field: Extract<FieldKind, { tag: 'singleNode' }>
): string {
  const { fieldName, typeName: fieldTypeName, optional } = field;
  const Field = capitalize(fieldName);
  const lines: string[] = [
    `  export function set${Field}(node: Dehydrated<${typeName}>, ${fieldName}: Dehydrated<${fieldTypeName}>): void {`,
    `    node.${fieldName} = ${fieldName};`,
    `  }`,
  ];
  if (optional) {
    lines.push(
      `  export function clear${Field}(node: Dehydrated<${typeName}>): void {`,
      `    node.${fieldName} = undefined;`,
      `  }`
    );
  }
  return lines.join('\n');
}

function emitCrossRefOps(
  typeName: string,
  field: Extract<FieldKind, { tag: 'crossRef' }>
): string {
  const { fieldName, targetType, optional } = field;
  const Field = capitalize(fieldName);
  const lines: string[] = [
    `  export function set${Field}(node: Dehydrated<${typeName}>, ref: Dehydrated<${targetType}>): void {`,
    `    node.${fieldName} = { $refText: ref.$namespace ? \`\${ref.$namespace}.\${ref.name}\` : ref.name };`,
    `  }`,
  ];
  if (optional) {
    lines.push(
      `  export function clear${Field}(node: Dehydrated<${typeName}>): void {`,
      `    node.${fieldName} = undefined;`,
      `  }`
    );
  }
  return lines.join('\n');
}

function emitNamespace(descriptor: ZodObjectTypeDescriptor): string | null {
  const ops: string[] = [];
  for (const prop of descriptor.properties) {
    const kind = classifyField(prop.name, prop.zodType, prop.optional);
    if (kind.tag === 'skip') continue;
    if (kind.tag === 'array') {
      ops.push(emitArrayOps(descriptor.name, kind));
    } else if (kind.tag === 'singleNode') {
      ops.push(emitSingleNodeOps(descriptor.name, kind));
    } else if (kind.tag === 'crossRef') {
      ops.push(emitCrossRefOps(descriptor.name, kind));
    }
  }
  if (ops.length === 0) return null;
  return [`export namespace ${descriptor.name} {`, ops.join('\n'), '}'].join('\n');
}

/**
 * Generates a TypeScript `domain.ts` that re-exports all AST interface types
 * from `./ast.js` and merges namespace-scoped ops for each member-container type.
 *
 * Array fields → 6-op set (get/add/insertAt/removeAt/setAt/moveAt).
 * Single contained-node fields → setXxx (+ clearXxx if optional).
 * Cross-reference fields → setXxx using $namespace.name (+ clearXxx if optional).
 * Primitive/literal fields → skipped.
 */
export function generateNamespaceOps(types: ZodTypeDescriptor[]): string {
  const objectTypes = types.filter((t): t is ZodObjectTypeDescriptor => t.kind === 'object');
  const typeNames = objectTypes.map((t) => t.name);

  const parts: string[] = [];

  // Re-export header
  if (typeNames.length > 0) {
    parts.push(`export type { ${typeNames.join(', ')} } from './ast.js';`);
  }

  parts.push('');
  parts.push(`import type { Dehydrated } from '../serializer/dehydrated.js';`);

  for (const descriptor of objectTypes) {
    const ns = emitNamespace(descriptor);
    if (ns !== null) {
      parts.push('');
      parts.push(ns);
    }
  }

  return parts.join('\n') + '\n';
}
