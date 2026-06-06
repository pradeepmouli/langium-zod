import type {
  ZodObjectTypeDescriptor,
  ZodTypeDescriptor,
  ZodTypeExpression,
  ZodUnionTypeDescriptor
} from '../types.js';
import { applyProjectionToDescriptors, type ProjectionConfig } from '../projection.js';

function capitalize(name: string): string {
  return name.length === 0 ? name : `${name[0]!.toUpperCase()}${name.slice(1)}`;
}

export interface DomainGenerationOptions {
  /** Reuses the Zod projection for `defaults.strip` + per-type `fields`. */
  projection?: ProjectionConfig;
  /** Drop `$`-internal metadata fields (`$container`, `$cstNode`, …). */
  stripInternals?: boolean;
}

/** TS surface type for a property's read shape. Single cross-refs flatten to `string`. */
function domainTsType(expression: ZodTypeExpression): string {
  switch (expression.kind) {
    case 'primitive':
      return expression.primitive; // 'string' | 'number' | 'boolean' | 'bigint'
    case 'literal':
      return JSON.stringify(expression.value);
    case 'reference':
      return `${expression.typeName}Domain`;
    case 'crossReference':
      return 'string';
    case 'array':
      return `${domainTsType(expression.element)}[]`;
    case 'union': {
      const inner = expression.members.map(domainTsType).join(' | ');
      return expression.members.length > 1 ? `(${inner})` : inner;
    }
    case 'lazy':
      return domainTsType(expression.inner);
  }
}

/** Read-projection expression mapping a source access path to the domain value. */
function domainReadExpr(expression: ZodTypeExpression, access: string): string {
  switch (expression.kind) {
    case 'primitive':
    case 'literal':
      return access;
    case 'crossReference':
      return `${access}?.$refText`;
    case 'reference':
      return `${access} ? toDomain${expression.typeName}(${access}) : undefined`;
    case 'array':
      return `(${access} ?? []).map((item) => ${domainReadExpr(expression.element, 'item')})`;
    case 'union':
      // Inline property-level unions pass through unchanged (rare — named unions
      // arrive as `reference`). Documented limitation; revisited in a later task.
      return access;
    case 'lazy':
      return domainReadExpr(expression.inner, access);
  }
}

/** Param type for a scalar/primitive setter or an array element add. */
function domainWriteType(expression: ZodTypeExpression): string {
  switch (expression.kind) {
    case 'primitive':
      return expression.primitive;
    case 'crossReference':
      return 'string';
    case 'literal':
      return JSON.stringify(expression.value);
    default:
      // reference (nested AST node), union, array, lazy: caller supplies a draft.
      return 'unknown';
  }
}

function emitAccessors(label: string, sourceName: string, expression: ZodTypeExpression): string[] {
  const src = `node.${sourceName}`;
  if (expression.kind === 'array') {
    const elementType = domainWriteType(expression.element);
    return [
      `export function add${label}(node: any, item: ${elementType}): void {`,
      expression.element.kind === 'crossReference'
        ? `  (${src} ??= []).push({ $refText: item });`
        : `  (${src} ??= []).push(item);`,
      '}',
      '',
      `export function remove${label}At(node: any, index: number): void {`,
      `  ${src}?.splice(index, 1);`,
      '}',
      ''
    ];
  }
  if (expression.kind === 'crossReference') {
    return [
      `export function set${label}(node: any, value: string): void {`,
      `  if (${src}) ${src}.$refText = value;`,
      '}',
      ''
    ];
  }
  if (expression.kind === 'primitive') {
    return [
      `export function set${label}(node: any, value: ${expression.primitive}): void {`,
      `  ${src} = value;`,
      '}',
      ''
    ];
  }
  // reference (nested object) scalar, literal, union: no setter in the MVP surface.
  return [];
}

function emitMasterDispatch(objects: ZodObjectTypeDescriptor[]): string[] {
  if (objects.length === 0) {
    return [];
  }
  const alias = `export type AnyDomain = ${objects.map((object) => `${object.name}Domain`).join(' | ')};`;
  const out = [alias, '', 'export function toDomain(node: any): AnyDomain {', '  switch (node.$type) {'];
  for (const object of objects) {
    out.push(`    case ${JSON.stringify(object.name)}: return toDomain${object.name}(node);`);
  }
  out.push('  }', '  throw new Error(`Unknown node type: ${node.$type}`);', '}', '');
  return out;
}

function emitUnion(descriptor: ZodUnionTypeDescriptor): string[] {
  const alias = `export type ${descriptor.name}Domain = ${descriptor.members
    .map((member) => `${member}Domain`)
    .join(' | ')};`;
  const out = [
    alias,
    '',
    `export function toDomain${descriptor.name}(node: any): ${descriptor.name}Domain {`,
    '  switch (node.$type) {'
  ];
  for (const member of descriptor.members) {
    out.push(`    case ${JSON.stringify(member)}: return toDomain${member}(node);`);
  }
  out.push(
    '  }',
    `  throw new Error(\`Unknown ${descriptor.name} member: \${node.$type}\`);`,
    '}',
    ''
  );
  return out;
}

function emitWriteAccessors(descriptor: ZodObjectTypeDescriptor): string[] {
  const out: string[] = [];
  for (const property of descriptor.properties) {
    if (property.name === '$type') {
      continue;
    }
    out.push(...emitAccessors(capitalize(property.name), property.name, property.zodType));
  }
  return out;
}

function emitReadFn(descriptor: ZodObjectTypeDescriptor): string[] {
  const out = [`export function toDomain${descriptor.name}(node: any): ${descriptor.name}Domain {`, '  return {'];
  for (const property of descriptor.properties) {
    if (property.name === '$type') {
      continue;
    }
    out.push(`    ${property.name}: ${domainReadExpr(property.zodType, `node.${property.name}`)},`);
  }
  out.push('  };', '}', '');
  return out;
}

function emitInterface(descriptor: ZodObjectTypeDescriptor): string[] {
  const out = [`export interface ${descriptor.name}Domain {`];
  for (const property of descriptor.properties) {
    if (property.name === '$type') {
      continue;
    }
    out.push(`  ${property.name}${property.optional ? '?' : ''}: ${domainTsType(property.zodType)};`);
  }
  out.push('}', '');
  return out;
}

export function generateDomainCode(
  descriptors: ZodTypeDescriptor[],
  options: DomainGenerationOptions = {}
): string {
  const surface = applyProjectionToDescriptors(descriptors, {
    projection: options.projection,
    stripInternals: options.stripInternals
  });
  const objects = surface.filter(
    (descriptor): descriptor is ZodObjectTypeDescriptor => descriptor.kind === 'object'
  );
  const unions = surface.filter(
    (descriptor): descriptor is ZodUnionTypeDescriptor => descriptor.kind === 'union'
  );

  const lines: string[] = [
    '// @ts-nocheck — generated domain surface; edit the grammar / domain-surfaces.json to regenerate',
    ''
  ];

  for (const object of objects) {
    lines.push(...emitInterface(object));
    lines.push(...emitReadFn(object));
    lines.push(...emitWriteAccessors(object));
  }

  for (const union of unions) {
    lines.push(...emitUnion(union));
  }

  lines.push(...emitMasterDispatch(objects));

  return `${lines.join('\n').trim()}\n`;
}
