import { build, type BaseBuilder } from 'x-to-zod/builders';
import type { ZodObjectTypeDescriptor, ZodPropertyDescriptor, ZodTypeDescriptor, ZodTypeExpression } from './types.js';

function expressionToBuilder(expression: ZodTypeExpression): BaseBuilder {
	switch (expression.kind) {
		case 'primitive':
			if (expression.primitive === 'string') {
				return build.string();
			}

			if (expression.primitive === 'number') {
				return build.number();
			}

			return build.boolean();
		case 'literal':
			return build.literal(expression.value);
		case 'reference':
			return build.raw(`${expression.typeName}Schema`);
		case 'array':
			return build.array(expressionToBuilder(expression.element));
		case 'crossReference':
			return build.raw('ReferenceSchema');
		case 'union':
			return build.union(expression.members.map((member) => expressionToBuilder(member)));
		case 'lazy':
			return build.lazy(expressionToBuilder(expression.inner));
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

function propertyLine(property: ZodPropertyDescriptor, ownerTypeName: string, recursiveTypes: Set<string>): string {
	const builder = expressionToBuilder(property.zodType);
	if (property.optional) {
		builder.optional();
	}

	const withOptional = builder.text();
	const shouldUseGetter = recursiveTypes.has(ownerTypeName) && propertyReferencesAnyCycleMember(property.zodType, recursiveTypes);

	if (shouldUseGetter) {
		return `\tget ${property.name}() { return ${withOptional}; }`;
	}

	return `\t${property.name}: ${withOptional}`;
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
						const bothAreRecursive = recursiveTypes.has(name) && recursiveTypes.has(ref);
						if (!bothAreRecursive) {
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

export function generateZodCode(descriptors: ZodTypeDescriptor[], recursiveTypes: Set<string>): string {
	const lines: string[] = [
		"import { z } from 'zod';",
		''
	];

	const hasCrossReferences = descriptors.some((descriptor) => descriptor.kind === 'object' && descriptor.properties.some((property) => containsCrossReference(property.zodType)));

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

	const objectDescriptors = descriptors.filter((d): d is ZodObjectTypeDescriptor => d.kind === 'object');
	const sortedObjects = topoSortObjectDescriptors(objectDescriptors, recursiveTypes);

	for (const descriptor of sortedObjects) {
		const hasRecursiveGetter = recursiveTypes.has(descriptor.name) && descriptor.properties.some((property) => propertyReferencesAnyCycleMember(property.zodType, recursiveTypes));

		if (hasRecursiveGetter) {
			lines.push(`export const ${descriptor.name}Schema = z.looseObject({`);
			for (const property of descriptor.properties) {
				lines.push(`${propertyLine(property, descriptor.name, recursiveTypes)},`);
			}
			lines.push('});');
			lines.push('');
			continue;
		}

		const objectProperties: Record<string, BaseBuilder> = {};
		for (const property of descriptor.properties) {
			const builder = expressionToBuilder(property.zodType);
			if (property.optional) {
				builder.optional();
			}
			objectProperties[property.name] = builder;
		}

		const objectBuilder = build.object(objectProperties).loose();
		lines.push(`export const ${descriptor.name}Schema = ${objectBuilder.text()};`);
		lines.push('');
	}

	for (const descriptor of descriptors) {
		if (descriptor.kind !== 'union') {
			continue;
		}

		const members = descriptor.members.map((member) => build.raw(`${member}Schema`));
		const unionBuilder = build.discriminatedUnion(descriptor.discriminator, members);
		lines.push(`export const ${descriptor.name}Schema = ${unionBuilder.text()};`);
		lines.push('');
	}

	return `${lines.join('\n').trim()}\n`;
}

