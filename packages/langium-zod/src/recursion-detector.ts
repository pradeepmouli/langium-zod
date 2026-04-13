import type { ZodPropertyDescriptor, ZodTypeDescriptor, ZodTypeExpression } from './types.js';

function collectReferenceTypeNames(expression: ZodTypeExpression): string[] {
	switch (expression.kind) {
		case 'reference':
			return [expression.typeName];
		case 'array':
			return collectReferenceTypeNames(expression.element);
		case 'union':
			return expression.members.flatMap((member) => collectReferenceTypeNames(member));
		case 'lazy':
			return collectReferenceTypeNames(expression.inner);
		default:
			return [];
	}
}

function propertyReferences(property: ZodPropertyDescriptor): string[] {
	return collectReferenceTypeNames(property.zodType);
}

/**
 * Detects type names that participate in a reference cycle across the descriptor
 * graph.
 *
 * Builds a directed graph where each object type descriptor is a node and each
 * type reference in its properties is an edge. A depth-first search then
 * identifies all nodes that belong to at least one cycle. The generator uses this
 * set to emit getter-based property accessors instead of direct value expressions,
 * avoiding JavaScript "used before declaration" errors for mutually-recursive Zod
 * schemas.
 *
 * Only `'object'` kind descriptors are considered; union and primitive-alias
 * descriptors are transparent to cycle detection.
 *
 * @param descriptors - The full list of type descriptors to analyse, as returned
 *   by {@link extractTypeDescriptors}.
 * @returns A `Set` of type names that are involved in at least one reference cycle.
 */
export function detectRecursiveTypes(descriptors: ZodTypeDescriptor[]): Set<string> {
	const edges = new Map<string, Set<string>>();

	for (const descriptor of descriptors) {
		if (descriptor.kind !== 'object') {
			continue;
		}

		const refs = new Set<string>();
		for (const property of descriptor.properties) {
			for (const typeName of propertyReferences(property)) {
				refs.add(typeName);
			}
		}
		edges.set(descriptor.name, refs);
	}

	const recursive = new Set<string>();
	const visited = new Set<string>();
	const visiting = new Set<string>();

	const dfs = (node: string, path: string[]): void => {
		if (visiting.has(node)) {
			const cycleStart = path.indexOf(node);
			const cycle = cycleStart >= 0 ? path.slice(cycleStart) : [node];
			for (const item of cycle) {
				recursive.add(item);
			}
			return;
		}

		if (visited.has(node)) {
			return;
		}

		visited.add(node);
		visiting.add(node);
		for (const next of edges.get(node) ?? []) {
			if (!edges.has(next)) {
				continue;
			}
			dfs(next, [...path, node]);
		}
		visiting.delete(node);
	};

	for (const node of edges.keys()) {
		dfs(node, []);
	}

	return recursive;
}
