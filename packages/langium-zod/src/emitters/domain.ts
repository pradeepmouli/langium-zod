import type {
  ZodObjectTypeDescriptor,
  ZodTypeDescriptor,
  ZodTypeExpression
} from '../types.js';
import { applyProjectionToDescriptors, type ProjectionConfig } from '../projection.js';

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

  const lines: string[] = [
    '// @ts-nocheck — generated domain surface; edit the grammar / domain-surfaces.json to regenerate',
    ''
  ];

  for (const object of objects) {
    lines.push(...emitInterface(object));
    lines.push(...emitReadFn(object));
  }

  return `${lines.join('\n').trim()}\n`;
}
