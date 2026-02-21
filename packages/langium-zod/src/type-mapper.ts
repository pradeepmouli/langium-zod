import type { PropertyLike, ZodTypeExpression } from './types.js';

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

	const normalized = normalizePropertyType(property.type);
	const sourceTypeName = property.referenceType ?? normalized.typeName ?? '';
	const primitive = mapTerminalToZod(sourceTypeName);

	let base: ZodTypeExpression;
	if (property.isCrossRef || normalized.isCrossRef) {
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
