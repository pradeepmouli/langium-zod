import { build, type BaseBuilder } from 'x-to-zod/builders';
import type { ZodPropertyDescriptor, ZodTypeDescriptor, ZodTypeExpression } from './types.js';

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

function propertyLine(property: ZodPropertyDescriptor, ownerTypeName: string, recursiveTypes: Set<string>): string {
	const builder = expressionToBuilder(property.zodType);
	if (property.optional) {
		builder.optional();
	}

	const withOptional = builder.text();
	const shouldUseGetter = recursiveTypes.has(ownerTypeName) && containsReferenceTo(property.zodType, ownerTypeName);

	if (shouldUseGetter) {
		return `\tget ${property.name}() { return ${withOptional}; }`;
	}

	return `\t${property.name}: ${withOptional}`;
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

	for (const descriptor of descriptors) {
		if (descriptor.kind !== 'object') {
			continue;
		}

		const hasRecursiveGetter = recursiveTypes.has(descriptor.name) && descriptor.properties.some((property) => containsReferenceTo(property.zodType, descriptor.name));

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
