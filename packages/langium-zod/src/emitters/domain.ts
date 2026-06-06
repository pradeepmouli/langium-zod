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

export interface DomainOverlayTypeConfig {
  /** Source field → domain field. Bidirectional: read & write both target the source. */
  renames?: Record<string, string>;
  /** Read-only aggregations: concat `from` source arrays into one `to` read field. */
  merges?: Array<{ from: string[]; to: string }>;
}

export interface DomainOverlayConfig {
  types?: Record<string, DomainOverlayTypeConfig>;
}

export interface DomainGenerationOptions {
  /** Reuses the Zod projection for `defaults.strip` + per-type `fields`. */
  projection?: ProjectionConfig;
  /** Drop `$`-internal metadata fields (`$container`, `$cstNode`, …). */
  stripInternals?: boolean;
  overlays?: DomainOverlayConfig;
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

interface DomainFieldPlan {
  name: string; // surface (domain) field name
  tsType: string;
  optional: boolean;
  readExpr: string; // expression in terms of `node`
}

interface AccessorPlan {
  label: string; // PascalCase fn label
  sourceName: string; // AST source field the accessor mutates
  expression: ZodTypeExpression;
}

interface DomainObjectPlan {
  name: string;
  fields: DomainFieldPlan[];
  accessors: AccessorPlan[];
}

function planObject(
  descriptor: ZodObjectTypeDescriptor,
  overlay: DomainOverlayTypeConfig | undefined
): DomainObjectPlan {
  const renames = overlay?.renames ?? {};
  const merges = overlay?.merges ?? [];
  const mergedSources = new Set(merges.flatMap((merge) => merge.from));

  const properties = descriptor.properties.filter((property) => property.name !== '$type');
  const fields: DomainFieldPlan[] = [];
  const accessors: AccessorPlan[] = [];

  for (const property of properties) {
    const isMergeSource = mergedSources.has(property.name);
    const domainName = renames[property.name] ?? property.name;
    if (!isMergeSource) {
      fields.push({
        name: domainName,
        tsType: domainTsType(property.zodType),
        optional: property.optional,
        readExpr: domainReadExpr(property.zodType, `node.${property.name}`)
      });
    }
    // Accessors always target the SOURCE field; merge sources keep distinct accessors.
    const label = capitalize(isMergeSource ? property.name : domainName);
    accessors.push({ label, sourceName: property.name, expression: property.zodType });
  }

  for (const merge of merges) {
    const knownNames = new Set(properties.map((property) => property.name));
    const fromSet = new Set(merge.from);
    for (const sourceName of merge.from) {
      const sourceProp = properties.find((property) => property.name === sourceName);
      if (!sourceProp) {
        throw new Error(
          `domain overlay merge for ${descriptor.name}: source field "${sourceName}" does not exist`
        );
      }
      if (sourceProp.zodType.kind !== 'array') {
        throw new Error(
          `domain overlay merge for ${descriptor.name}: source field "${sourceName}" is not an array (merges aggregate arrays)`
        );
      }
    }
    if (knownNames.has(merge.to) && !fromSet.has(merge.to)) {
      throw new Error(
        `domain overlay merge for ${descriptor.name}: target "${merge.to}" collides with an existing non-source field`
      );
    }

    const sourceProps = merge.from
      .map((sourceName) => properties.find((property) => property.name === sourceName))
      .filter((property): property is (typeof properties)[number] => property !== undefined);

    const firstArray = sourceProps.find((property) => property.zodType.kind === 'array');
    const elementTsType =
      firstArray && firstArray.zodType.kind === 'array'
        ? domainTsType(firstArray.zodType.element)
        : 'unknown';

    const spreadExprs = sourceProps
      .filter((property) => property.zodType.kind === 'array')
      .map((property) => `...${domainReadExpr(property.zodType, `node.${property.name}`)}`);

    fields.push({
      name: merge.to,
      tsType: `${elementTsType}[]`,
      optional: false,
      readExpr: `[${spreadExprs.join(', ')}]`
    });
  }

  return { name: descriptor.name, fields, accessors };
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

function emitInterface(plan: DomainObjectPlan): string[] {
  const out = [`export interface ${plan.name}Domain {`];
  for (const field of plan.fields) {
    out.push(`  ${field.name}${field.optional ? '?' : ''}: ${field.tsType};`);
  }
  out.push('}', '');
  return out;
}

function emitReadFn(plan: DomainObjectPlan): string[] {
  const out = [`export function toDomain${plan.name}(node: any): ${plan.name}Domain {`, '  return {'];
  for (const field of plan.fields) {
    out.push(`    ${field.name}: ${field.readExpr},`);
  }
  out.push('  };', '}', '');
  return out;
}

function emitWriteAccessors(plan: DomainObjectPlan): string[] {
  const out: string[] = [];
  for (const accessor of plan.accessors) {
    out.push(...emitAccessors(accessor.label, accessor.sourceName, accessor.expression));
  }
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

  const overlayTypes = options.overlays?.types ?? {};
  for (const object of objects) {
    const plan = planObject(object, overlayTypes[object.name]);
    lines.push(...emitInterface(plan));
    lines.push(...emitReadFn(plan));
    lines.push(...emitWriteAccessors(plan));
  }

  for (const union of unions) {
    lines.push(...emitUnion(union));
  }

  lines.push(...emitMasterDispatch(objects));

  return `${lines.join('\n').trim()}\n`;
}
