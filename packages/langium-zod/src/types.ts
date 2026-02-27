export type ZodPrimitive = 'string' | 'number' | 'boolean';

export type ZodTypeExpression =
	| { kind: 'primitive'; primitive: ZodPrimitive }
	| { kind: 'literal'; value: string }
	| { kind: 'reference'; typeName: string }
	| { kind: 'array'; element: ZodTypeExpression }
	| { kind: 'crossReference'; targetType: string }
	| { kind: 'union'; members: ZodTypeExpression[] }
	| { kind: 'lazy'; inner: ZodTypeExpression };

export interface ZodPropertyDescriptor {
	name: string;
	zodType: ZodTypeExpression;
	optional: boolean;
}

export interface ZodObjectTypeDescriptor {
	name: string;
	kind: 'object';
	properties: ZodPropertyDescriptor[];
}

export interface ZodUnionTypeDescriptor {
	name: string;
	kind: 'union';
	members: string[];
	discriminator: string;
}

/** Emits `export const XSchema = z.string()` (or number/boolean) for Langium datatype rules. */
export interface ZodPrimitiveAliasDescriptor {
	name: string;
	kind: 'primitive-alias';
	primitive: ZodPrimitive;
}

/** Emits `export const XSchema = z.union([z.literal("a"), z.literal("b")])` for Langium keyword enum rules. */
export interface ZodKeywordEnumDescriptor {
	name: string;
	kind: 'keyword-enum';
	keywords: string[];
}

export type ZodTypeDescriptor = ZodObjectTypeDescriptor | ZodUnionTypeDescriptor | ZodPrimitiveAliasDescriptor | ZodKeywordEnumDescriptor;

export interface InterfaceTypeLike {
	name: string;
	properties?: PropertyLike[];
	superTypes?: Set<string> | string[];
}

export interface UnionTypeLike {
	name: string;
	type?: unknown;
	members?: string[];
}

export interface PropertyLike {
	name: string;
	type?: unknown;
	optional?: boolean;
	operator?: '=' | '+=' | '?=';
	assignment?: '=' | '+=' | '?=';
	isCrossRef?: boolean;
	referenceType?: string;
}

export interface AstTypesLike {
	interfaces: InterfaceTypeLike[];
	unions: UnionTypeLike[];
}
