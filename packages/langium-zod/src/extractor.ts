import type {
	AstTypesLike,
	InterfaceTypeLike,
	PropertyLike,
	UnionTypeLike,
	ZodPropertyDescriptor,
	ZodTypeDescriptor
} from './types.js';
import type { FilterConfig } from './config.js';
import { ZodGeneratorError } from './errors.js';
import { mapPropertyType } from './type-mapper.js';

function toStringSet(value: unknown): Set<string> {
	if (!value) {
		return new Set();
	}

	if (value instanceof Set) {
		return new Set(Array.from(value).filter((entry): entry is string => typeof entry === 'string'));
	}

	if (Array.isArray(value)) {
		return new Set(value.filter((entry): entry is string => typeof entry === 'string'));
	}

	return new Set();
}

function shouldInclude(name: string, config?: FilterConfig): boolean {
	const include = config?.include ?? [];
	const exclude = config?.exclude ?? [];

	if (include.length > 0) {
		return include.includes(name);
	}

	if (exclude.length > 0) {
		return !exclude.includes(name);
	}

	return true;
}

function resolveProperties(typeMap: Map<string, InterfaceTypeLike>, typeName: string, visiting = new Set<string>()): PropertyLike[] {
	if (visiting.has(typeName)) {
		return [];
	}
	visiting.add(typeName);

	const current = typeMap.get(typeName);
	if (!current) {
		return [];
	}

	const merged = new Map<string, PropertyLike>();
	for (const superType of toStringSet(current.superTypes)) {
		for (const inherited of resolveProperties(typeMap, superType, visiting)) {
			merged.set(inherited.name, inherited);
		}
	}

	for (const property of current.properties ?? []) {
		merged.set(property.name, property);
	}

	visiting.delete(typeName);
	return Array.from(merged.values());
}

function extractUnionMembers(unionType: UnionTypeLike): string[] {
	if (Array.isArray(unionType.members)) {
		return unionType.members.filter((member): member is string => typeof member === 'string');
	}

	const source = unionType.type as { types?: unknown[]; alternatives?: unknown[] } | undefined;
	const alternatives = source?.types ?? source?.alternatives ?? [];
	if (!Array.isArray(alternatives)) {
		return [];
	}

	const members: string[] = [];
	for (const item of alternatives) {
		if (typeof item === 'string') {
			members.push(item);
			continue;
		}
		if (item && typeof item === 'object') {
			const maybeName = (item as { name?: unknown; type?: unknown }).name ?? (item as { type?: unknown }).type;
			if (typeof maybeName === 'string') {
				members.push(maybeName);
			}
		}
	}

	return members;
}

export function extractTypeDescriptors(astTypes: AstTypesLike, config?: FilterConfig): ZodTypeDescriptor[] {
	const interfaces = astTypes.interfaces ?? [];
	const unions = astTypes.unions ?? [];
	const typeMap = new Map(interfaces.map((type) => [type.name, type]));

	const objectDescriptors: ZodTypeDescriptor[] = [];
	for (const entry of interfaces) {
		if (!shouldInclude(entry.name, config)) {
			continue;
		}

		const properties: ZodPropertyDescriptor[] = [
			{
				name: '$type',
				zodType: { kind: 'literal', value: entry.name },
				optional: false
			}
		];

		for (const property of resolveProperties(typeMap, entry.name)) {
			if (property.name.startsWith('$') && property.name !== '$type') {
				continue;
			}

			const zodType = mapPropertyType(property);
			if (zodType.kind === 'reference' && zodType.typeName === 'unknown') {
				throw new ZodGeneratorError('Failed to map property type to Zod schema', {
					typeName: entry.name,
					grammarElement: property.name,
					suggestion: 'Use a resolvable terminal or AST type reference in grammar assignments'
				});
			}

			properties.push({
				name: property.name,
				zodType,
				optional: Boolean(property.optional)
			});
		}

		objectDescriptors.push({
			name: entry.name,
			kind: 'object',
			properties
		});
	}

	const includedTypeNames = new Set(objectDescriptors.map((descriptor) => descriptor.name));
	const unionDescriptors: ZodTypeDescriptor[] = [];

	for (const entry of unions) {
		if (!shouldInclude(entry.name, config)) {
			continue;
		}

		const filteredMembers = extractUnionMembers(entry).filter((member) => includedTypeNames.has(member));
		if (filteredMembers.length === 0) {
			continue;
		}

		unionDescriptors.push({
			name: entry.name,
			kind: 'union',
			members: filteredMembers,
			discriminator: '$type'
		});
	}

	return [...objectDescriptors, ...unionDescriptors];
}
