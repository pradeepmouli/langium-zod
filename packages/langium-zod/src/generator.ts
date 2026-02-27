import { build, type BaseBuilder } from 'x-to-zod/builders';
import type { ZodObjectTypeDescriptor, ZodPropertyDescriptor, ZodTypeDescriptor, ZodTypeExpression } from './types.js';
import type { ZodKeywordEnumDescriptor, ZodRegexEnumDescriptor } from './types.js';
import { applyProjectionToDescriptors, type ProjectionConfig } from './projection.js';

export interface GenerationOptions {
	projection?: ProjectionConfig;
	stripInternals?: boolean;
	crossRefValidation?: boolean;
}

/**
 * Converts a ZodTypeExpression into an x-to-zod builder.
 *
 * @param lazyNames - Type names that must be wrapped in `z.lazy()` because they
 *   are declared later in the file (e.g. union schemas emitted after object schemas).
 */
function expressionToBuilder(expression: ZodTypeExpression, lazyNames: ReadonlySet<string> = new Set()): BaseBuilder {
	switch (expression.kind) {
		case 'primitive':
			if (expression.primitive === 'string') {
				return build.string();
			}

			if (expression.primitive === 'number') {
				return build.number();
			}

			if (expression.primitive === 'bigint') {
				return build.raw('z.bigint()');
			}

			return build.boolean();
		case 'literal':
			return build.literal(expression.value);
		case 'reference':
			if (lazyNames.has(expression.typeName)) {
				// Union schemas are emitted after all object schemas, so references
				// from object properties to union types must be lazy to avoid
				// "used before declaration" TypeScript errors.
				return build.lazy(build.raw(`${expression.typeName}Schema`));
			}

			return build.raw(`${expression.typeName}Schema`);
		case 'array':
			return build.array(expressionToBuilder(expression.element, lazyNames));
		case 'crossReference':
			return build.raw('ReferenceSchema');
		case 'union':
			return build.union(expression.members.map((member) => expressionToBuilder(member, lazyNames)));
		case 'lazy':
			return build.lazy(expressionToBuilder(expression.inner, lazyNames));
	}
}

function containsCrossReference(expression: ZodTypeExpression): boolean {
	switch (expression.kind) {
		case 'crossReference':
			return true;
		case 'array':
			return containsCrossReference(expression.element);
		case 'union':
			return expression.members.some((member) => containsCrossReference(member));
		case 'lazy':
			return containsCrossReference(expression.inner);
		default:
			return false;
	}
}

function containsReferenceTo(expression: ZodTypeExpression, typeName: string): boolean {
	switch (expression.kind) {
		case 'reference':
			return expression.typeName === typeName;
		case 'array':
			return containsReferenceTo(expression.element, typeName);
		case 'union':
			return expression.members.some((member) => containsReferenceTo(member, typeName));
		case 'lazy':
			return containsReferenceTo(expression.inner, typeName);
		default:
			return false;
	}
}

function propertyReferencesAnyCycleMember(zodType: ZodTypeExpression, recursiveTypes: Set<string>): boolean {
	for (const rt of recursiveTypes) {
		if (containsReferenceTo(zodType, rt)) {
			return true;
		}
	}
	return false;
}

function renderPropertyExpression(property: ZodPropertyDescriptor, lazyNames: ReadonlySet<string>): string {
	const baseExpression = expressionToBuilder(property.zodType, lazyNames).text();
	const withArrayMin = property.zodType.kind === 'array' && typeof property.minItems === 'number'
		? `${baseExpression}.min(${property.minItems})`
		: baseExpression;

	if (property.optional) {
		return `${withArrayMin}.optional()`;
	}

	return withArrayMin;
}

function renderRefinedCrossRefExpression(expression: ZodTypeExpression): string {
	switch (expression.kind) {
		case 'crossReference':
			return `zRef(() => refs.${expression.targetType} ?? [])`;
		case 'array': {
			const inner = renderRefinedCrossRefExpression(expression.element);
			return `z.array(${inner})`;
		}
		case 'union': {
			const members = expression.members.map((member) => renderRefinedCrossRefExpression(member));
			return `z.union([${members.join(', ')}])`;
		}
		case 'primitive':
			if (expression.primitive === 'string') return 'z.string()';
			if (expression.primitive === 'number') return 'z.number()';
			if (expression.primitive === 'bigint') return 'z.bigint()';
			return 'z.boolean()';
		case 'literal':
			return `z.literal(${JSON.stringify(expression.value)})`;
		case 'reference':
			return `${expression.typeName}Schema`;
		case 'lazy':
			return `z.lazy(() => ${renderRefinedCrossRefExpression(expression.inner)})`;
	}
}

function renderCrossRefPropertyExpression(property: ZodPropertyDescriptor): string {
	const baseExpression = renderRefinedCrossRefExpression(property.zodType);
	const withArrayMin = property.zodType.kind === 'array' && typeof property.minItems === 'number'
		? `${baseExpression}.min(${property.minItems})`
		: baseExpression;

	if (property.optional) {
		return `${withArrayMin}.optional()`;
	}

	return withArrayMin;
}

function propertyLine(property: ZodPropertyDescriptor, ownerTypeName: string, recursiveTypes: Set<string>, lazyNames: ReadonlySet<string> = new Set()): string {
	const expression = renderPropertyExpression(property, lazyNames);
	const shouldUseGetter = recursiveTypes.has(ownerTypeName) && propertyReferencesAnyCycleMember(property.zodType, recursiveTypes);

	if (shouldUseGetter) {
		return `\tget ${property.name}() { return ${expression}; }`;
	}

	return `\t${property.name}: ${expression}`;
}

/**
 * Topologically sorts object descriptors so that each type's dependencies are
 * emitted before it. References within a cycle (recursiveTypes) are safe
 * regardless of order because they are emitted using getter syntax.
 */
function topoSortObjectDescriptors(descriptors: ZodObjectTypeDescriptor[], recursiveTypes: Set<string>): ZodObjectTypeDescriptor[] {
	const nameToDesc = new Map(descriptors.map((d) => [d.name, d]));
	const sorted: ZodObjectTypeDescriptor[] = [];
	const visited = new Set<string>();
	const visiting = new Set<string>();

	function visit(name: string): void {
		if (visited.has(name)) {
			return;
		}

		visiting.add(name);
		const d = nameToDesc.get(name);
		if (d) {
			for (const property of d.properties) {
				for (const ref of collectReferenceTypeNames(property.zodType)) {
					if (nameToDesc.has(ref) && !visiting.has(ref)) {
						const shouldUseGetter =
							recursiveTypes.has(name) &&
							propertyReferencesAnyCycleMember(property.zodType, recursiveTypes);
						if (!shouldUseGetter) {
							visit(ref);
						}
					}
				}
			}
		}

		visiting.delete(name);
		visited.add(name);
		if (d) {
			sorted.push(d);
		}
	}

	for (const d of descriptors) {
		visit(d.name);
	}

	return sorted;
}

function collectReferenceTypeNames(expression: ZodTypeExpression): string[] {
	switch (expression.kind) {
		case 'reference':
			return [expression.typeName];
		case 'array':
			return collectReferenceTypeNames(expression.element);
		case 'union':
			return expression.members.flatMap((m) => collectReferenceTypeNames(m));
		case 'lazy':
			return collectReferenceTypeNames(expression.inner);
		default:
			return [];
	}
}

export function generateZodCode(
	descriptors: ZodTypeDescriptor[],
	recursiveTypes: Set<string>,
	options: GenerationOptions = {},
): string {
	const surfaceDescriptors = applyProjectionToDescriptors(descriptors, {
		projection: options.projection,
		stripInternals: options.stripInternals
	});

	const lines: string[] = [
		'// @ts-nocheck — generated file; edit generate-zod.ts to regenerate',
		"import { z } from 'zod';"
	];

	if (options.crossRefValidation) {
		lines.push("import { zRef } from 'langium-zod';");
	}

	lines.push('');

	// Names of union descriptors — object properties that reference these must use
	// z.lazy() because union schemas are emitted after all object schemas.
	const unionNames = new Set(surfaceDescriptors.filter((d) => d.kind === 'union').map((d) => d.name));

	const hasCrossReferences = surfaceDescriptors.some((descriptor) => descriptor.kind === 'object' && descriptor.properties.some((property) => containsCrossReference(property.zodType)));

	if (hasCrossReferences) {
		const referenceBuilder = build
			.object({
				$refText: build.string(),
				ref: build.unknown().optional()
			})
			.loose();

		lines.push(`export const ReferenceSchema = ${referenceBuilder.text()};`);
		lines.push('');

	}

	// 1. Keyword-enum, regex-enum, and primitive alias schemas first — they have no dependencies
	//    and are referenced by object schemas as leaf nodes.
	for (const descriptor of surfaceDescriptors) {
		if (descriptor.kind === 'keyword-enum') {
			const { keywords } = descriptor as ZodKeywordEnumDescriptor;
			const members = keywords.map((kw) => `z.literal(${JSON.stringify(kw)})`).join(', ');
			const zodExpr = keywords.length === 1
				? `z.literal(${JSON.stringify(keywords[0])})`
				: `z.union([${members}])`;
			lines.push(`export const ${descriptor.name}Schema = ${zodExpr};`);
			lines.push('');
		}
	}

	for (const descriptor of surfaceDescriptors) {
		if (descriptor.kind === 'regex-enum') {
			const { regex, keywords } = descriptor as ZodRegexEnumDescriptor;
			// Strip wrapping slashes to get the raw pattern: "/foo/" → "foo"
			const pattern = regex.startsWith('/') && regex.endsWith('/') ? regex.slice(1, -1) : regex;
			const regexPart = `z.string().regex(new RegExp(${JSON.stringify(pattern)}))`;
			const zodExpr = keywords.length === 0
				? regexPart
				: `z.union([${regexPart}, ${keywords.map((kw) => `z.literal(${JSON.stringify(kw)})`).join(', ')}])`;
			lines.push(`export const ${descriptor.name}Schema = ${zodExpr};`);
			lines.push('');
		}
	}

	for (const descriptor of surfaceDescriptors) {
		if (descriptor.kind !== 'primitive-alias') {
			continue;
		}
		const zodExpr =
			descriptor.primitive === 'number' ? 'z.number()' :
			descriptor.primitive === 'boolean' ? 'z.boolean()' :
			descriptor.primitive === 'bigint' ? 'z.bigint()' :
			'z.string()';
		lines.push(`export const ${descriptor.name}Schema = ${zodExpr};`);
		lines.push('');
	}

	// 2. Object schemas in topological dependency order.
	//    References to union names use z.lazy() since unions are emitted last.
	const objectDescriptors = surfaceDescriptors.filter((d): d is ZodObjectTypeDescriptor => d.kind === 'object');
	const sortedObjects = topoSortObjectDescriptors(objectDescriptors, recursiveTypes);

	for (const descriptor of sortedObjects) {
		const hasRecursiveGetter = recursiveTypes.has(descriptor.name) && descriptor.properties.some((property) => propertyReferencesAnyCycleMember(property.zodType, recursiveTypes));

		if (hasRecursiveGetter) {
			lines.push(`export const ${descriptor.name}Schema = z.looseObject({`);
			for (const property of descriptor.properties) {
				lines.push(`${propertyLine(property, descriptor.name, recursiveTypes, unionNames)},`);
			}
			lines.push('});');
			lines.push('');
			continue;
		}

		const objectProperties: Record<string, BaseBuilder> = {};
		for (const property of descriptor.properties) {
			objectProperties[property.name] = build.raw(renderPropertyExpression(property, unionNames));
		}

		const objectBuilder = build.object(objectProperties).loose();
		lines.push(`export const ${descriptor.name}Schema = ${objectBuilder.text()};`);
		lines.push('');
	}

	// 3. Discriminated union schemas last — all member object schemas are
	//    already declared above.
	for (const descriptor of surfaceDescriptors) {
		if (descriptor.kind !== 'union') {
			continue;
		}

		const members = descriptor.members.map((member) => build.raw(`${member}Schema`));
		const unionBuilder = build.discriminatedUnion(descriptor.discriminator, members);
		lines.push(`export const ${descriptor.name}Schema = ${unionBuilder.text()};`);
		lines.push('');
	}

	// 4. Master union across all emitted object schemas using `$type`.
	//    Useful as a single entry point for validating any AST node.
	const onlyObject = sortedObjects[0];
	if (sortedObjects.length === 1 && onlyObject) {
		lines.push(`export const AstNodeSchema = ${onlyObject.name}Schema;`);
		lines.push('');
	} else if (sortedObjects.length > 1) {
		const allMembers = sortedObjects.map((descriptor) => build.raw(`${descriptor.name}Schema`));
		const allTypesUnionBuilder = build.discriminatedUnion('$type', allMembers);
		lines.push(`export const AstNodeSchema = ${allTypesUnionBuilder.text()};`);
		lines.push('');
	}

	if (options.crossRefValidation) {
		for (const descriptor of sortedObjects) {
			const crossRefProperties = descriptor.properties.filter((property) => containsCrossReference(property.zodType));
			if (crossRefProperties.length === 0) {
				continue;
			}

			const targetTypes = new Set<string>();
			for (const property of crossRefProperties) {
				const stack: ZodTypeExpression[] = [property.zodType];
				while (stack.length > 0) {
					const current = stack.pop();
					if (!current) {
						continue;
					}
					if (current.kind === 'crossReference') {
						targetTypes.add(current.targetType);
						continue;
					}
					if (current.kind === 'array') {
						stack.push(current.element);
						continue;
					}
					if (current.kind === 'union') {
						stack.push(...current.members);
						continue;
					}
					if (current.kind === 'lazy') {
						stack.push(current.inner);
					}
				}
			}

			lines.push(`export interface ${descriptor.name}SchemaRefs {`);
			for (const targetType of targetTypes) {
				lines.push(`	${targetType}?: string[];`);
			}
			lines.push('}');
			lines.push('');

			lines.push(`export function create${descriptor.name}Schema(refs: ${descriptor.name}SchemaRefs = {}) {`);
			lines.push('	return z.looseObject({');
			for (const property of descriptor.properties) {
				const expression = containsCrossReference(property.zodType)
					? renderCrossRefPropertyExpression(property)
					: renderPropertyExpression(property, unionNames);
				lines.push(`		"${property.name}": ${expression},`);
			}
			lines.push('	});');
			lines.push('}');
			lines.push('');
		}
	}

	return `${lines.join('\n').trim()}\n`;
}
