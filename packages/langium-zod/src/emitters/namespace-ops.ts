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

function capitalize(s: string): string {
  return s.length === 0 ? s : `${s[0]!.toUpperCase()}${s.slice(1)}`;
}

function emitArrayOps(typeName: string, field: Extract<FieldKind, { tag: 'array' }>): string {
  const { fieldName, elementType } = field;
  const singular = singularize(fieldName);
  const safeSingular = safeParam(singular);
  const Singular = capitalize(singular);
  const Field = capitalize(fieldName);
  const S = IMPORT_ALIAS_SUFFIX;
  const lines: string[] = [
    `  export function get${Field}(node: Dehydrated<${typeName}${S}>): Dehydrated<${elementType}${S}>[] {`,
    `    return node.${fieldName};`,
    `  }`,
    `  export function add${Singular}(node: Dehydrated<${typeName}${S}>, ${safeSingular}: Dehydrated<${elementType}${S}>): void {`,
    `    node.${fieldName}.push(${safeSingular});`,
    `  }`,
    `  export function insert${Singular}At(node: Dehydrated<${typeName}${S}>, index: number, ${safeSingular}: Dehydrated<${elementType}${S}>): void {`,
    `    node.${fieldName}.splice(index, 0, ${safeSingular});`,
    `  }`,
    `  export function remove${Singular}At(node: Dehydrated<${typeName}${S}>, index: number): void {`,
    `    node.${fieldName}.splice(index, 1);`,
    `  }`,
    `  export function set${Singular}At(node: Dehydrated<${typeName}${S}>, index: number, ${safeSingular}: Dehydrated<${elementType}${S}>): void {`,
    `    node.${fieldName}[index] = ${safeSingular};`,
    `  }`,
    `  export function move${Singular}At(node: Dehydrated<${typeName}${S}>, from: number, to: number): void {`,
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
  const S = IMPORT_ALIAS_SUFFIX;
  const lines: string[] = [
    `  export function set${Field}(node: Dehydrated<${typeName}${S}>, ${safeFieldParam}: Dehydrated<${fieldTypeName}${S}>): void {`,
    `    node.${fieldName} = ${safeFieldParam};`,
    `  }`,
  ];
  if (optional) {
    lines.push(
      `  export function clear${Field}(node: Dehydrated<${typeName}${S}>): void {`,
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
  const S = IMPORT_ALIAS_SUFFIX;
  const lines: string[] = [
    `  export function set${Field}(node: Dehydrated<${typeName}${S}>, refText: string): void {`,
    `    node.${fieldName} = { $refText: refText };`,
    `  }`,
  ];
  if (optional) {
    lines.push(
      `  export function clear${Field}(node: Dehydrated<${typeName}${S}>): void {`,
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
 * Suffix used for import aliases to avoid TS2395 ("Individual declarations in merged
 * declaration must be all exported or all local"). We import `Data as Data$` and use
 * `Data$` in function signatures so that the public `export namespace Data` is the only
 * declaration of that name in this file.
 */
const IMPORT_ALIAS_SUFFIX = '$';

export function generateNamespaceOps(types: ZodTypeDescriptor[]): string {
  const objectTypes = types.filter((t): t is ZodObjectTypeDescriptor => t.kind === 'object');
  const typeNames = objectTypes.map((t) => t.name);
  const objectTypeNames = new Set(typeNames);

  const parts: string[] = [];

  // Import with alias suffix so `export namespace Foo` doesn't conflict with `import type { Foo }`.
  if (typeNames.length > 0) {
    const aliasedImports = typeNames.map((n) => `${n} as ${n}${IMPORT_ALIAS_SUFFIX}`).join(', ');
    parts.push(`import type { ${aliasedImports} } from './ast.js';`);
  }

  parts.push('');
  parts.push(`import type { Dehydrated } from '../serializer/dehydrated.js';`);

  for (const descriptor of objectTypes) {
    const ns = emitNamespace(descriptor, objectTypeNames);
    if (ns !== null) {
      parts.push('');
      parts.push(ns);
    }
  }

  return parts.join('\n') + '\n';
}
