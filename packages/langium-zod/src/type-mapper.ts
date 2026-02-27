import type { PropertyLike, ZodPrimitive, ZodTypeExpression } from './types.js';

export function mapTerminalToZod(terminalName: string): ZodTypeExpression | undefined {
	if (terminalName === 'ID' || terminalName === 'STRING' || terminalName === 'string') {
		return { kind: 'primitive', primitive: 'string' };
	}

	if (terminalName === 'INT' || terminalName === 'number') {
		return { kind: 'primitive', primitive: 'number' };
	}

	if (terminalName === 'boolean') {
		return { kind: 'primitive', primitive: 'boolean' };
	}

	return undefined;
}

/**
 * Maps Langium's actual PropertyType discriminated union variants to ZodTypeExpression.
 *
 * Langium 4.x PropertyType variants:
 *   PrimitiveType  { primitive: 'string' | 'number' | 'boolean' }
 *   StringType     { string: string }          — keyword literal match
 *   ValueType      { value: { name: string } } — reference to an interface/union
 *   ReferenceType  { referenceType: PropertyType; isMulti?: boolean } — cross-reference
 *   ArrayType      { elementType: PropertyType }
 *   PropertyUnion  { types: PropertyType[] }
 */
function mapLangiumPropertyType(type: unknown): ZodTypeExpression | undefined {
	if (!type || typeof type !== 'object') {
		return undefined;
	}

	const t = type as Record<string, unknown>;

	// PrimitiveType: { primitive: 'string' | 'number' | 'boolean' }
	if ('primitive' in t && typeof t['primitive'] === 'string') {
		const p = t['primitive'] as ZodPrimitive;
		if (p === 'string' || p === 'number' || p === 'boolean') {
			return { kind: 'primitive', primitive: p };
		}
		// Langium may surface other datatype-rule primitive names, default to string
		return { kind: 'primitive', primitive: 'string' };
	}

	// StringType: { string: string } — keyword match, always a string
	if ('string' in t && typeof t['string'] === 'string') {
		return { kind: 'primitive', primitive: 'string' };
	}

	// ValueType: { value: { name: string } } — reference to an interface or union type
	if ('value' in t && t['value'] && typeof t['value'] === 'object') {
		const value = t['value'] as Record<string, unknown>;
		if (typeof value['name'] === 'string') {
			return { kind: 'reference', typeName: value['name'] };
		}
	}

	// ReferenceType: { referenceType: PropertyType } — cross-reference [Type]
	// The inner referenceType is typically a ValueType { value: { name: string } }
	if ('referenceType' in t && t['referenceType']) {
		const innerRef = t['referenceType'] as Record<string, unknown>;
		let targetType = 'unknown';
		if (innerRef['value'] && typeof innerRef['value'] === 'object') {
			const val = innerRef['value'] as Record<string, unknown>;
			if (typeof val['name'] === 'string') {
				targetType = val['name'];
			}
		}
		return { kind: 'crossReference', targetType };
	}

	// ArrayType: { elementType: PropertyType }
	if ('elementType' in t && t['elementType']) {
		const inner = mapLangiumPropertyType(t['elementType']);
		if (inner) {
			return { kind: 'array', element: inner };
		}
	}

	// PropertyUnion: { types: PropertyType[] } — union / optional branches
	if ('types' in t && Array.isArray(t['types'])) {
		const members = (t['types'] as unknown[])
			.map((item) => mapLangiumPropertyType(item))
			.filter((m): m is ZodTypeExpression => m !== undefined);
		if (members.length === 1) {
			return members[0];
		}
		if (members.length > 1) {
			return { kind: 'union', members };
		}
	}

	return undefined;
}

function normalizePropertyType(propertyType: unknown): { typeName?: string; isArray: boolean; isCrossRef: boolean } {
	if (typeof propertyType === 'string') {
		return {
			typeName: propertyType,
			isArray: false,
			isCrossRef: false
		};
	}

	if (!propertyType || typeof propertyType !== 'object') {
		return { isArray: false, isCrossRef: false };
	}

	const candidate = propertyType as {
		elementType?: unknown;
		type?: unknown;
		name?: string;
		referenceType?: string;
		isCrossRef?: boolean;
		crossRef?: boolean;
	};

	if (candidate.elementType) {
		const nested = normalizePropertyType(candidate.elementType);
		return {
			typeName: nested.typeName,
			isArray: true,
			isCrossRef: nested.isCrossRef
		};
	}

	if (candidate.type) {
		const nested = normalizePropertyType(candidate.type);
		return {
			typeName: nested.typeName,
			isArray: false,
			isCrossRef: nested.isCrossRef
		};
	}

	const typeName =
		typeof candidate.referenceType === 'string'
			? candidate.referenceType
			: typeof candidate.name === 'string'
				? candidate.name
				: undefined;

	return {
		typeName,
		isArray: false,
		isCrossRef: Boolean(candidate.isCrossRef || candidate.crossRef)
	};
}

export function mapPropertyType(property: PropertyLike): ZodTypeExpression {
	const assignmentOperator = property.assignment ?? property.operator ?? '=';
	if (assignmentOperator === '?=') {
		return { kind: 'primitive', primitive: 'boolean' };
	}

	// Explicit cross-reference marker takes precedence over type inspection
	if (property.isCrossRef) {
		const base: ZodTypeExpression = { kind: 'crossReference', targetType: 'unknown' };
		if (assignmentOperator === '+=') {
			return { kind: 'array', element: base };
		}
		return base;
	}

	// Try Langium's native PropertyType discriminated union first.
	// This handles: PrimitiveType { primitive }, StringType { string }, ValueType { value },
	// ReferenceType { referenceType }, ArrayType { elementType }, PropertyUnion { types }.
	const langiumResult = mapLangiumPropertyType(property.type);
	if (langiumResult) {
		// Don't double-wrap — mapLangiumPropertyType handles ArrayType internally
		if (assignmentOperator === '+=' && langiumResult.kind !== 'array') {
			return { kind: 'array', element: langiumResult };
		}
		return langiumResult;
	}

	// Legacy fallback: simple string type names and duck-typed wrapper shapes
	const normalized = normalizePropertyType(property.type);
	const sourceTypeName = property.referenceType ?? normalized.typeName ?? '';
	const primitive = mapTerminalToZod(sourceTypeName);

	let base: ZodTypeExpression;
	if (normalized.isCrossRef) {
		base = {
			kind: 'crossReference',
			targetType: sourceTypeName || 'unknown'
		};
	} else if (primitive) {
		base = primitive;
	} else if (sourceTypeName) {
		base = {
			kind: 'reference',
			typeName: sourceTypeName
		};
	} else {
		base = {
			kind: 'reference',
			typeName: 'unknown'
		};
	}

	if (assignmentOperator === '+=' || normalized.isArray) {
		return {
			kind: 'array',
			element: base
		};
	}

	return base;
}
