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
  optional: boolean,
  objectTypeNames: Set<string>,
): FieldKind {
  if (zodType.kind === 'array') {
    const el = zodType.element;
    if (el.kind === 'reference' && objectTypeNames.has(el.typeName)) {
      return { tag: 'array', fieldName, elementType: el.typeName };
    }
    // Union/crossRef/primitive/non-object-reference arrays are not yet supported; ops are skipped silently.
    return { tag: 'skip' };
  }
  if (zodType.kind === 'reference') {
    // Skip references to non-object types (e.g. ValidID string unions).
    if (!objectTypeNames.has(zodType.typeName)) return { tag: 'skip' };
    return { tag: 'singleNode', fieldName, typeName: zodType.typeName, optional };
  }
  if (zodType.kind === 'crossReference') {
    return { tag: 'crossRef', fieldName, targetType: zodType.targetType, optional };
  }
  return { tag: 'skip' };
}

// TypeScript reserved words that cannot be used as parameter names.
const RESERVED = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for',
  'function', 'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with',
  'as', 'implements', 'interface', 'let', 'package', 'private', 'protected', 'public',
  'static', 'type', 'yield',
]);

/** Returns a safe parameter name for the given field name, appending `_` if reserved. */
function safeParam(name: string): string {
  return RESERVED.has(name) ? `${name}_` : name;
}

/** Strip trailing 's' for simple pluralization inversion. e.g. 'attributes' → 'attribute' */
function singularize(name: string): string {
  return name.endsWith('s') ? name.slice(0, -1) : name;
}

/**
 * Qualify an AST type name through the `import * as ast` namespace binding.
 * `export * from './ast.js'` re-exports names to consumers but does NOT bring them
 * into this module's lexical scope, so signatures must reference `ast.Foo` (a real
 * local binding) rather than a bare `Foo`.
 */
function astRef(typeName: string): string {
  return `ast.${typeName}`;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : `${s[0]!.toUpperCase()}${s.slice(1)}`;
}

function emitArrayOps(typeName: string, field: Extract<FieldKind, { tag: 'array' }>): string {
  const { fieldName, elementType } = field;
  const singular = singularize(fieldName);
  const safeSingular = safeParam(singular);
  const Singular = capitalize(singular);
  const Field = capitalize(fieldName);
  const T = astRef(typeName);
  const E = astRef(elementType);
  const lines: string[] = [
    `  export function get${Field}(node: Dehydrated<${T}>): Dehydrated<${E}>[] {`,
    `    return node.${fieldName};`,
    `  }`,
    `  export function add${Singular}(node: Dehydrated<${T}>, ${safeSingular}: Dehydrated<${E}>): void {`,
    `    node.${fieldName}.push(${safeSingular});`,
    `  }`,
    `  export function insert${Singular}At(node: Dehydrated<${T}>, index: number, ${safeSingular}: Dehydrated<${E}>): void {`,
    `    node.${fieldName}.splice(index, 0, ${safeSingular});`,
    `  }`,
    `  export function remove${Singular}At(node: Dehydrated<${T}>, index: number): void {`,
    `    node.${fieldName}.splice(index, 1);`,
    `  }`,
    `  export function set${Singular}At(node: Dehydrated<${T}>, index: number, ${safeSingular}: Dehydrated<${E}>): void {`,
    `    node.${fieldName}[index] = ${safeSingular};`,
    `  }`,
    `  export function move${Singular}At(node: Dehydrated<${T}>, from: number, to: number): void {`,
    `    const [item] = node.${fieldName}.splice(from, 1);`,
    `    if (item === undefined) return;`,
    `    node.${fieldName}.splice(to, 0, item);`,
    `  }`,
  ];
  return lines.join('\n');
}

function emitSingleNodeOps(
  typeName: string,
  field: Extract<FieldKind, { tag: 'singleNode' }>
): string {
  const { fieldName, typeName: fieldTypeName, optional } = field;
  const safeFieldParam = safeParam(fieldName);
  const Field = capitalize(fieldName);
  const T = astRef(typeName);
  const F = astRef(fieldTypeName);
  const lines: string[] = [
    `  export function set${Field}(node: Dehydrated<${T}>, ${safeFieldParam}: Dehydrated<${F}>): void {`,
    `    node.${fieldName} = ${safeFieldParam};`,
    `  }`,
  ];
  if (optional) {
    lines.push(
      `  export function clear${Field}(node: Dehydrated<${T}>): void {`,
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
  const { fieldName, optional } = field;
  const Field = capitalize(fieldName);
  const T = astRef(typeName);
  const lines: string[] = [
    `  export function set${Field}(node: Dehydrated<${T}>, refText: string): void {`,
    `    node.${fieldName} = { $refText: refText };`,
    `  }`,
  ];
  if (optional) {
    lines.push(
      `  export function clear${Field}(node: Dehydrated<${T}>): void {`,
      `    node.${fieldName} = undefined;`,
      `  }`
    );
  }
  return lines.join('\n');
}

function emitNamespace(descriptor: ZodObjectTypeDescriptor, objectTypeNames: Set<string>): string | null {
  const ops: string[] = [];
  for (const prop of descriptor.properties) {
    const kind = classifyField(prop.name, prop.zodType, prop.optional, objectTypeNames);
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
/**
 * No import-alias suffix is used. The generated `domain.ts` is a single barrel:
 *
 *   import * as ast from './ast.js';
 *   export * from './ast.js';              // forwards every guard / reflection / non-namespaced type
 *   export type Data = ast.Data;           // local type alias — shadows the star-exported interface
 *   export namespace Data { ... }          // local value — shadows the star-exported reflection const
 *
 * A local `type` + `namespace` pair under the same name merges (type space + value space)
 * and, per TypeScript export precedence, shadows the corresponding names brought in by
 * `export * from './ast.js'`. So function signatures reference bare `Data` / `Attribute`,
 * which resolve to the local alias (namespaced types) or the star-exported interface
 * (non-namespaced element types) — no `$`-suffixed aliases, no TS2395.
 */
export function generateNamespaceOps(types: ZodTypeDescriptor[]): string {
  const objectTypes = types.filter((t): t is ZodObjectTypeDescriptor => t.kind === 'object');
  const objectTypeNames = new Set(objectTypes.map((t) => t.name));

  const parts: string[] = [];

  parts.push(`import * as ast from './ast.js';`);
  parts.push(`import type { Dehydrated } from '../serializer/dehydrated.js';`);
  parts.push('');
  // Re-export the entire AST surface (interfaces, type guards, reflection, terminals,
  // union types) so `domain.ts` is the sole core barrel. The per-type `export type` and
  // `export namespace` declarations below shadow the interface + reflection-const for the
  // namespaced types; everything else flows through unchanged.
  parts.push(`export * from './ast.js';`);

  for (const descriptor of objectTypes) {
    const ns = emitNamespace(descriptor, objectTypeNames);
    if (ns === null) continue;
    parts.push('');
    // Local type alias re-exposes the interface under the same name the namespace uses,
    // so the merged `Data` is both a type and an ops namespace at every call site.
    parts.push(`export type ${descriptor.name} = ast.${descriptor.name};`);
    parts.push(ns);
  }

  return parts.join('\n') + '\n';
}
