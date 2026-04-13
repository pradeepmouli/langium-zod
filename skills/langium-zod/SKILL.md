---
name: langium-zod
description: "A Langium generator plugin that derives Zod validation schemas from grammar definitions, enabling runtime validation of AST nodes in Langium-based language tools Use when working with langium, zod, dsl, grammar, code-generation, validation, schema, parser, type-safe, ast."
license: MIT
---

# langium-zod

A Langium generator plugin that derives Zod validation schemas from grammar definitions, enabling runtime validation of AST nodes in Langium-based language tools

## When to Use

- Working with langium, zod, dsl, grammar, code-generation, validation, schema, parser, type-safe, ast
- API surface: 9 functions, 2 classes, 13 types, 2 constants

## Quick Reference

**api:** `generateZodSchemas`
**extractor:** `extractTypeDescriptors`
**generator:** `generateZodCode`
**recursion-detector:** `detectRecursiveTypes`
**ref-utils:** `zRef`
**cli:** `resolveFilterOverrides`, `getUnknownFilterNames`, `generate`, `main`, `LangiumZodConfig`, `GenerateOptions`
**errors:** `ZodGeneratorError`
**di:** `DefaultZodSchemaGenerator`, `ZodSchemaGenerator`, `ZodSchemaGeneratorServices`, `ZodSchemaGeneratorModule`
**config:** `FilterConfig`, `ZodGeneratorConfig`, `DEFAULT_OUTPUT_PATH`
**types:** `AstTypesLike`, `InterfaceTypeLike`, `PropertyLike`, `UnionTypeLike`, `ZodPropertyDescriptor`, `ZodTypeDescriptor`, `ZodTypeExpression`

## Links

- [Repository](https://github.com/pradeepmouli/langium-zod)
- Author: Pradeep Mouli <pmouli@mac.com>