import type {
	AstTypesLike,
	InterfaceTypeLike,
	PropertyLike,
	UnionTypeLike,
	ZodPropertyDescriptor,
	ZodTypeDescriptor,
	ZodTypeExpression
} from './types.js';
import type { ZodKeywordEnumDescriptor } from './types.js';
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

/**
 * Extract the string member names from a Langium union type.
 *
 * Handles two layouts:
 *   1. Plain array:  { members: string[] }
 *   2. Langium 4.x:  { type: { types: [ { value: { name: 'X' } }, ... ] } }
 *      or the older: { type: { alternatives: [ { name: 'X' }, ... ] } }
 */
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
		if (!item || typeof item !== 'object') {
			continue;
		}
		const obj = item as Record<string, unknown>;

		// Langium 4.x PropertyUnion item: ValueType { value: { name: string } }
		if (obj['value'] && typeof obj['value'] === 'object') {
			const val = obj['value'] as Record<string, unknown>;
			if (typeof val['name'] === 'string') {
				members.push(val['name']);
				continue;
			}
		}

		// Legacy / plain duck-typed: { name: string } or { type: string }
		const maybeName = obj['name'] ?? obj['type'];
		if (typeof maybeName === 'string') {
			members.push(maybeName);
		}
	}

	return members;
}

/**
 * Resolve keyword literals for a Langium keyword enum rule
 * (e.g. `CardinalityModifier returns string: 'any' | 'all'`).
 * Returns the keyword strings when all union members are string literals, undefined otherwise.
 */
function resolveKeywordEnum(unionType: UnionTypeLike): string[] | undefined {
	const source = unionType.type as Record<string, unknown> | undefined;
	if (!source) {
		return undefined;
	}

	// PropertyUnion where every member is a StringType: { types: [ { string: 'any' }, ... ] }
	if (Array.isArray(source['types'])) {
		const keywords: string[] = [];
		for (const item of source['types'] as unknown[]) {
			if (!item || typeof item !== 'object') {
				return undefined;
			}
			const t = item as Record<string, unknown>;
			if (typeof t['string'] === 'string') {
				keywords.push(t['string']);
			} else {
				// Mixed with non-string-literal members — not a keyword enum
				return undefined;
			}
		}
		return keywords.length > 0 ? keywords : undefined;
	}

	// Single StringType at top level: { string: 'any' }
	if (typeof source['string'] === 'string') {
		return [source['string']];
	}

	return undefined;
}

/**
 * Resolve the primitive kind for a Langium union that aliases a single primitive type
 * (e.g. `type ValidID = ID` → 'string', `type Integer = INT` → 'number').
 * Returns undefined when the union is not a simple primitive alias.
 */
function resolvePrimitiveAlias(unionType: UnionTypeLike): 'string' | 'number' | 'boolean' | undefined {
	const source = unionType.type as Record<string, unknown> | undefined;
	if (!source) {
		return undefined;
	}

	// PrimitiveType: { primitive: 'string' | 'number' | 'boolean' }
	if (typeof source['primitive'] === 'string') {
		const p = source['primitive'];
		if (p === 'string' || p === 'number' || p === 'boolean') {
			return p;
		}
		return 'string'; // unknown primitives default to string
	}

	// PropertyUnion whose only members are primitives: { types: [ { primitive: ... }, ... ] }
	if (Array.isArray(source['types'])) {
		const primitives = new Set<string>();
		for (const item of source['types'] as unknown[]) {
			if (item && typeof item === 'object') {
				const t = item as Record<string, unknown>;
				if (typeof t['primitive'] === 'string') {
					primitives.add(t['primitive']);
				}
			}
		}
		if (primitives.size > 0 && [...primitives].every((p) => p === 'string' || p === 'number' || p === 'boolean')) {
			// All primitives — pick dominant type (string wins over number/boolean)
			if (primitives.has('string')) return 'string';
			if (primitives.has('number')) return 'number';
			return 'boolean';
		}
	}

	return undefined;
}

/** Collect all type names referenced as `{ kind: 'reference', typeName }` in an expression tree. */
function collectReferences(expr: ZodTypeExpression, out: Set<string>): void {
	switch (expr.kind) {
		case 'reference':
			out.add(expr.typeName);
			break;
		case 'array':
			collectReferences(expr.element, out);
			break;
		case 'union':
			for (const m of expr.members) collectReferences(m, out);
			break;
		case 'lazy':
			collectReferences(expr.inner, out);
			break;
	}
}

export function extractTypeDescriptors(astTypes: AstTypesLike, config?: FilterConfig): ZodTypeDescriptor[] {
	const interfaces = astTypes.interfaces ?? [];
	const unions = astTypes.unions ?? [];
	const typeMap = new Map(interfaces.map((type) => [type.name, type]));
	const unionMap = new Map(unions.map((u) => [u.name, u]));

	// ── Phase 1: object descriptors from interface types ─────────────────────
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

	// ── Phase 2: union and primitive-alias descriptors ────────────────────────
	const includedInterfaceNames = new Set(objectDescriptors.map((d) => d.name));
	const unionDescriptors: ZodTypeDescriptor[] = [];

	for (const entry of unions) {
		if (!shouldInclude(entry.name, config)) {
			continue;
		}

		const allMembers = extractUnionMembers(entry);
		const filteredMembers = allMembers.filter((member) => includedInterfaceNames.has(member));

		if (filteredMembers.length > 0) {
			// Discriminated union of known interface types
			unionDescriptors.push({
				name: entry.name,
				kind: 'union',
				members: filteredMembers,
				discriminator: '$type'
			});
		} else {
			// No interface members — check if this is a keyword enum (e.g. 'any' | 'all')
			const keywords = resolveKeywordEnum(entry);
			if (keywords) {
				unionDescriptors.push({
					name: entry.name,
					kind: 'keyword-enum',
					keywords
				} satisfies ZodKeywordEnumDescriptor);
			} else {
				// Check if this is a primitive alias (e.g. ValidID = string)
				const primitive = resolvePrimitiveAlias(entry);
				if (primitive) {
					unionDescriptors.push({
						name: entry.name,
						kind: 'primitive-alias',
						primitive
					});
				}
				// Otherwise silently skip (e.g. unions whose members are other unions, handled below)
			}
		}
	}

	// ── Phase 3: resolve dangling references ─────────────────────────────────
	// Any reference type in property descriptors that isn't an emitted interface,
	// union, or primitive-alias needs a stub. This covers Langium datatype rules
	// (ValidID, BigDecimal, etc.) that don't appear in astTypes.interfaces.
	const generatedNames = new Set([
		...objectDescriptors.map((d) => d.name),
		...unionDescriptors.map((d) => d.name)
	]);

	const referencedNames = new Set<string>();
	for (const desc of objectDescriptors) {
		if (desc.kind !== 'object') continue;
		for (const prop of desc.properties) {
			collectReferences(prop.zodType, referencedNames);
		}
	}
	// Also traverse union members that in turn reference things
	for (const desc of unionDescriptors) {
		if (desc.kind === 'union') {
			for (const member of desc.members) {
				referencedNames.add(member);
			}
		}
	}

	const stubDescriptors: ZodTypeDescriptor[] = [];
	for (const refName of referencedNames) {
		if (generatedNames.has(refName)) {
			continue;
		}
		if (!shouldInclude(refName, config)) {
			continue;
		}
		// Check if the union map has a keyword enum or primitive alias for this name
		const unionEntry = unionMap.get(refName);
		const keywords = unionEntry ? resolveKeywordEnum(unionEntry) : undefined;
		if (keywords) {
			stubDescriptors.push({
				name: refName,
				kind: 'keyword-enum',
				keywords
			} satisfies ZodKeywordEnumDescriptor);
		} else {
			const primitive = unionEntry ? resolvePrimitiveAlias(unionEntry) : undefined;
			stubDescriptors.push({
				name: refName,
				kind: 'primitive-alias',
				primitive: primitive ?? 'string' // default to string for unknown datatype rules
			});
		}
	}

	return [...objectDescriptors, ...unionDescriptors, ...stubDescriptors];
}
