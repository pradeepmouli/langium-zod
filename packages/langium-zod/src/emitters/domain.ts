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
  }

  return `${lines.join('\n').trim()}\n`;
}
