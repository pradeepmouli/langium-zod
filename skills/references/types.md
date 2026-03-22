# Types & Enums

## Types

### `FilterConfig`

### `ZodGeneratorConfig`

### `AstTypesLike`

### `InterfaceTypeLike`

### `PropertyLike`

### `UnionTypeLike`

### `ZodPropertyDescriptor`

### `ZodTypeDescriptor`
```ts
ZodObjectTypeDescriptor | ZodUnionTypeDescriptor | ZodPrimitiveAliasDescriptor | ZodKeywordEnumDescriptor | ZodRegexEnumDescriptor
```

### `ZodTypeExpression`
```ts
{ kind: "primitive"; primitive: ZodPrimitive } | { kind: "literal"; value: string } | { kind: "reference"; typeName: string } | { kind: "array"; element: ZodTypeExpression } | { kind: "crossReference"; targetType: string } | { kind: "union"; members: ZodTypeExpression[] } | { kind: "lazy"; inner: ZodTypeExpression }
```

### `ZodSchemaGenerator`

### `ZodSchemaGeneratorServices`
