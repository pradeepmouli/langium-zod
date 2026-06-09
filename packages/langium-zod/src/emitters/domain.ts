import type {
  ZodObjectTypeDescriptor,
  ZodTypeDescriptor,
  ZodTypeExpression,
  ZodUnionTypeDescriptor
} from '../types.js';
import { applyProjectionToDescriptors, type ProjectionConfig } from '../projection.js';

/** Context threaded through type/read helpers to classify references correctly. */
interface DomainCtx {
  /** Names of object/union types that DO have a generated Domain interface + toDomain fn. */
  richTypeNames: Set<string>;
  /** Returns the primitive TS type for a datatype-rule name (non-rich reference). */
  datatypePrimitive: (name: string) => string;
}

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

export interface NormalizationConfig {
  /** Canonical field name to add (e.g. `'extends'` or `'members'`). */
  as: string;
  /**
   * Per-kind source field: `{ TypeName: 'sourceFieldName' }`.
   * The alias reuses the source field's already-projected `tsType` and `readExpr` verbatim.
   * Values match the post-rename domain field name. If the source field is absent on a
   * kind's planned fields, the alias is silently skipped for that kind.
   */
  from: Record<string, string>;
}

export interface DomainGenerationOptions {
  /** Reuses the Zod projection for `defaults.strip` + per-type `fields`. */
  projection?: ProjectionConfig;
  /** Drop `$`-internal metadata fields (`$container`, `$cstNode`, …). */
  stripInternals?: boolean;
  overlays?: DomainOverlayConfig;
  /**
   * Additive read-only normalizations: each entry appends a canonical alias field to
   * every kind that maps to a source field via `from`, reusing the source field's
   * projected `tsType` and `readExpr`. No setter is emitted for alias fields.
   */
  normalizations?: Record<string, NormalizationConfig>;
}

/** TS surface type for a property's read shape. Cross-refs surface as editable `DomainRef` objects. */
function domainTsType(expression: ZodTypeExpression, ctx: DomainCtx): string {
  switch (expression.kind) {
    case 'primitive':
      return expression.primitive; // 'string' | 'number' | 'boolean' | 'bigint'
    case 'literal':
      return JSON.stringify(expression.value);
    case 'reference':
      // Non-rich references (datatype rules, keyword-enums, etc.) resolve to a primitive.
      return ctx.richTypeNames.has(expression.typeName)
        ? `${expression.typeName}Domain`
        : ctx.datatypePrimitive(expression.typeName);
    case 'crossReference':
      return 'DomainRef';
    case 'array':
      return `${domainTsType(expression.element, ctx)}[]`;
    case 'union': {
      const inner = expression.members.map((m) => domainTsType(m, ctx)).join(' | ');
      return expression.members.length > 1 ? `(${inner})` : inner;
    }
    case 'lazy':
      return domainTsType(expression.inner, ctx);
  }
}

/** Read-projection expression mapping a source access path to the domain value. */
function domainReadExpr(expression: ZodTypeExpression, access: string, ctx: DomainCtx): string {
  switch (expression.kind) {
    case 'primitive':
    case 'literal':
      return access;
    case 'crossReference':
      // Normalise to a plain DomainRef: strip the Langium-runtime `ref` / `$error` properties
      // that a live Reference object carries (they hold circular AstNode pointers and must NOT
      // reach the domain surface or JSON.stringify will throw "Converting circular structure").
      // A pre-normalised DomainRef ({$refText}) passes through unchanged because accessing
      // .$refText on it is safe and the result is the same plain object shape.
      return `${access} ? { $refText: ${access}.$refText } : undefined`;
    case 'reference':
      // Datatype-rule / keyword-enum references are primitives on the AST — read directly.
      return ctx.richTypeNames.has(expression.typeName)
        ? `${access} ? toDomain${expression.typeName}(${access}) : undefined`
        : access;
    case 'array':
      return `(${access} ?? []).map((item) => ${domainReadExpr(expression.element, 'item', ctx)})`;
    case 'union':
      // Inline property-level unions pass through unchanged (rare — named unions
      // arrive as `reference`). Documented limitation; revisited in a later task.
      return access;
    case 'lazy':
      return domainReadExpr(expression.inner, access, ctx);
  }
}

/** Inverse-projection expression: domain value at `access` back to an AST-shaped value. */
function domainToAstExpr(expression: ZodTypeExpression, access: string, ctx: DomainCtx): string {
  switch (expression.kind) {
    case 'primitive':
    case 'literal':
    case 'crossReference':
      // Extract only $refText — strips any circular Langium runtime pointers a
      // caller might pass in (live Reference objects carry ref/$container cycles).
      return `(${access} != null ? { $refText: ${access}.$refText } : ${access})`;
    case 'reference':
      return ctx.richTypeNames.has(expression.typeName)
        ? `${access} ? toAst${expression.typeName}(${access}) : undefined`
        : access;
    case 'array':
      return `(${access} ?? []).map((item) => ${domainToAstExpr(expression.element, 'item', ctx)})`;
    case 'union':
      return access;
    case 'lazy':
      return domainToAstExpr(expression.inner, access, ctx);
  }
}

/** Param type for a scalar/primitive setter or an array element add. */
function domainWriteType(expression: ZodTypeExpression, ctx: DomainCtx): string {
  switch (expression.kind) {
    case 'primitive':
      return expression.primitive;
    case 'crossReference':
      return 'string';
    case 'literal':
      return JSON.stringify(expression.value);
    case 'reference':
      // Non-rich references are primitives on the AST; rich ones are nested objects.
      return ctx.richTypeNames.has(expression.typeName) ? 'unknown' : ctx.datatypePrimitive(expression.typeName);
    default:
      // union, array, lazy: caller supplies a draft.
      return 'unknown';
  }
}

interface DomainFieldPlan {
  name: string; // surface (domain) field name
  tsType: string;
  optional: boolean;
  readExpr: string; // expression in terms of `node`
  /** True for additive normalization aliases — no write accessor should be emitted. */
  readOnly?: boolean;
  /** Source expression + source field name, for the toAst inverse. Absent on $type seed + aliases. */
  sourceName?: string;
  sourceExpr?: ZodTypeExpression;
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
  overlay: DomainOverlayTypeConfig | undefined,
  ctx: DomainCtx,
  normalizations?: Record<string, NormalizationConfig>
): DomainObjectPlan {
  const renames = overlay?.renames ?? {};
  const merges = overlay?.merges ?? [];
  const mergedSources = new Set(merges.flatMap((merge) => merge.from));

  const properties = descriptor.properties.filter((property) => property.name !== '$type');
  const fields: DomainFieldPlan[] = [
    // $type is always first — the literal discriminant for the union; no write accessor.
    { name: '$type', tsType: `'${descriptor.name}'`, optional: false, readExpr: 'node.$type' }
  ];
  const accessors: AccessorPlan[] = [];

  for (const property of properties) {
    const isMergeSource = mergedSources.has(property.name);
    const domainName = renames[property.name] ?? property.name;
    if (!isMergeSource) {
      fields.push({
        name: domainName,
        tsType: domainTsType(property.zodType, ctx),
        optional: property.optional,
        readExpr: domainReadExpr(property.zodType, `node.${property.name}`, ctx),
        sourceName: property.name,
        sourceExpr: property.zodType
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
        ? domainTsType(firstArray.zodType.element, ctx)
        : 'unknown';

    const spreadExprs = sourceProps
      .filter((property) => property.zodType.kind === 'array')
      .map((property) => `...${domainReadExpr(property.zodType, `node.${property.name}`, ctx)}`);

    fields.push({
      name: merge.to,
      tsType: `${elementTsType}[]`,
      optional: false,
      readExpr: `[${spreadExprs.join(', ')}]`
    });
  }

  // Additive normalization pass: for each normalization whose `from` maps this kind,
  // find the already-planned source field and append a read-only alias using its
  // projected `tsType` and `readExpr` verbatim. If the source field is not present
  // in the plan (e.g. stripped), skip silently. A name collision THROWS — never
  // silently skip — so a config typo can't drop the canonical field.
  if (normalizations) {
    for (const norm of Object.values(normalizations)) {
      const sourceFieldName = norm.from[descriptor.name];
      if (!sourceFieldName) continue;

      const sourcePlan = fields.find((f) => f.name === sourceFieldName);
      if (!sourcePlan) continue;

      if (fields.some((f) => f.name === norm.as)) {
        throw new Error(
          `domain normalization "${norm.as}" for ${descriptor.name}: target collides with an existing field`
        );
      }

      fields.push({
        name: norm.as,
        tsType: sourcePlan.tsType,
        optional: sourcePlan.optional,
        readExpr: sourcePlan.readExpr,
        readOnly: true
      });
    }
  }

  return { name: descriptor.name, fields, accessors };
}

function emitAccessors(label: string, sourceName: string, expression: ZodTypeExpression, ctx: DomainCtx): string[] {
  const src = `node.${sourceName}`;
  if (expression.kind === 'array') {
    const elementType = domainWriteType(expression.element, ctx);
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
    // Fix: create the slot when absent so optional cross-refs can be set from scratch.
    return [
      `export function set${label}(node: any, value: string): void {`,
      `  if (${src}) ${src}.$refText = value;`,
      `  else ${src} = { $refText: value };`,
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
  if (expression.kind === 'reference' && !ctx.richTypeNames.has(expression.typeName)) {
    // Non-rich reference (datatype rule): primitive-valued field, emit a scalar setter.
    const primitiveType = ctx.datatypePrimitive(expression.typeName);
    return [
      `export function set${label}(node: any, value: ${primitiveType}): void {`,
      `  ${src} = value;`,
      '}',
      ''
    ];
  }
  // Rich reference (nested object) scalar, literal, union: no setter in the MVP surface.
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

function emitToAstFn(plan: DomainObjectPlan, ctx: DomainCtx): string[] {
  const out = [`export function toAst${plan.name}(node: any): any {`, '  return {', `    $type: '${plan.name}',`];
  for (const field of plan.fields) {
    if (field.name === '$type') continue; // emitted as the literal head
    if (field.readOnly) continue; // additive normalization alias — intentionally not written back
    // No AST source: either the $type seed or a MERGE-TARGET field. Merge targets are a
    // read-only aggregation that cannot be faithfully inverted (the split point between the
    // merged source arrays is lost), so toAst cannot restore them — a `merges` overlay is
    // therefore incompatible with the round-trippable editable model (use `normalizations`,
    // which are additive + reversible, instead). Read-only projection consumers may still use
    // merges; they just don't round-trip through toAst.
    if (!field.sourceExpr || !field.sourceName) continue;
    out.push(`    ${field.sourceName}: ${domainToAstExpr(field.sourceExpr, `node.${field.name}`, ctx)},`);
  }
  out.push('  };', '}', '');
  return out;
}

function emitToAstUnion(descriptor: ZodUnionTypeDescriptor): string[] {
  const out = [`export function toAst${descriptor.name}(node: any): any {`, '  switch (node.$type) {'];
  for (const member of descriptor.members) {
    out.push(`    case ${JSON.stringify(member)}: return toAst${member}(node);`);
  }
  out.push('  }', `  throw new Error(\`Unknown ${descriptor.name} member: \${node.$type}\`);`, '}', '');
  return out;
}

function emitToAstMaster(objects: ZodObjectTypeDescriptor[]): string[] {
  if (objects.length === 0) return [];
  const out = ['export function toAst(node: any): any {', '  switch (node.$type) {'];
  for (const object of objects) {
    out.push(`    case ${JSON.stringify(object.name)}: return toAst${object.name}(node);`);
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

function emitWriteAccessors(plan: DomainObjectPlan, ctx: DomainCtx): string[] {
  const out: string[] = [];
  for (const accessor of plan.accessors) {
    out.push(...emitAccessors(`${plan.name}${accessor.label}`, accessor.sourceName, accessor.expression, ctx));
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

  // Build the classification context:
  // - richTypeNames: object and union types that get a Domain interface + toDomain fn.
  // - datatypePrimitive: resolves datatype-rule names (primitive-alias, keyword-enum,
  //   regex-enum) to their primitive TS type; defaults to 'string' for unknowns.
  const richTypeNames = new Set<string>([
    ...objects.map((o) => o.name),
    ...unions.map((u) => u.name)
  ]);
  const datatypeMap = new Map<string, string>();
  for (const descriptor of surface) {
    if (descriptor.kind === 'primitive-alias') {
      datatypeMap.set(descriptor.name, descriptor.primitive);
    } else if (descriptor.kind === 'keyword-enum' || descriptor.kind === 'regex-enum') {
      datatypeMap.set(descriptor.name, 'string');
    }
  }
  const ctx: DomainCtx = {
    richTypeNames,
    datatypePrimitive: (name) => datatypeMap.get(name) ?? 'string'
  };

  const lines: string[] = [
    '// @ts-nocheck — generated domain surface; edit the grammar / domain-surfaces.json to regenerate',
    '',
    '/** Editable cross-reference: the runtime ref shape. Resolution stays derived/external. */',
    'export interface DomainRef { $refText: string }',
    ''
  ];

  const overlayTypes = options.overlays?.types ?? {};
  for (const object of objects) {
    const plan = planObject(object, overlayTypes[object.name], ctx, options.normalizations);
    lines.push(...emitInterface(plan));
    lines.push(...emitReadFn(plan));
    lines.push(...emitToAstFn(plan, ctx));
    lines.push(...emitWriteAccessors(plan, ctx));
  }

  for (const union of unions) {
    lines.push(...emitUnion(union));
    lines.push(...emitToAstUnion(union));
  }

  lines.push(...emitMasterDispatch(objects));
  lines.push(...emitToAstMaster(objects));

  return `${lines.join('\n').trim()}\n`;
}
