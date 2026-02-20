# Implementation Plan: Langium Zod Generator Plugin

**Branch**: `001-langium-zod-plugin` | **Date**: 2026-02-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-langium-zod-plugin/spec.md`

## Summary

Build a Langium generator plugin that derives Zod 4.x validation schemas from grammar definitions. The plugin uses Langium's `collectAst()` API to extract the resolved type system (interfaces + unions), transforms it into an intermediate representation (`ZodTypeDescriptor[]`), and passes it to the user's `x-to-zod` library for Zod code generation. Output is a single `zod-schemas.ts` file using `z.looseObject()` for passthrough mode, `z.discriminatedUnion()` for union types, and getter-based recursion for circular references.

## Technical Context

**Language/Version**: TypeScript 5.x (ESM modules)
**Primary Dependencies**: `langium` 4.x (grammar/type system), `zod` 4.x (generated output target), `x-to-zod` (user's library for Zod code generation)
**Storage**: N/A (pure code generation, no persistence)
**Testing**: Vitest (already configured in monorepo)
**Target Platform**: Node.js >= 20.0.0
**Project Type**: Monorepo package (pnpm workspace)
**Performance Goals**: Generate schemas for 50+ AST types in under 2 seconds
**Constraints**: Output must be valid TypeScript, directly importable without transformation
**Scale/Scope**: Grammars with up to 100+ AST node types

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution is in template state (no custom principles defined). No gates to enforce beyond standard development practices:
- Tests required for all packages (per monorepo conventions)
- Conventional commits (per DEVELOPMENT.md)
- TypeScript strict mode
- ESLint + Prettier formatting

**Pre-design check**: PASS (no violations)
**Post-design check**: PASS (no violations — single package follows monorepo pattern, uses published x-to-zod from npm)

## Project Structure

### Documentation (this feature)

```text
specs/001-langium-zod-plugin/
├── plan.md              # This file
├── research.md          # Phase 0: Technology decisions
├── data-model.md        # Phase 1: IR and type mapping
├── quickstart.md        # Phase 1: Usage guide
├── contracts/           # Phase 1: API contracts
│   └── generator-api.md # Generator API contract
├── checklists/          # Quality checklists
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
└── langium-zod/                    # Langium plugin package
    ├── src/
    │   ├── index.ts                # Public API: generateZodSchemas, ZodSchemaGenerator
    │   ├── extractor.ts            # Langium AstTypes → ZodTypeDescriptor[] transformation
    │   ├── type-mapper.ts          # Property type → ZodTypeExpression mapping
    │   ├── recursion-detector.ts   # Detect circular type references for lazy evaluation
    │   ├── generator.ts            # ZodTypeDescriptor[] → Zod code via x-to-zod builder API
    │   ├── config.ts               # ZodGeneratorConfig type and defaults
    │   ├── errors.ts               # ZodGeneratorError class
    │   ├── types.ts                # IR types: ZodTypeDescriptor, ZodPropertyDescriptor, ZodTypeExpression
    │   └── di.ts                   # Langium DI service wrapper
    ├── test/
    │   ├── unit/
    │   │   ├── extractor.test.ts   # Unit tests for type extraction
    │   │   ├── type-mapper.test.ts # Unit tests for type mapping
    │   │   └── recursion-detector.test.ts # Unit tests for recursion detection
    │   ├── integration/
    │   │   ├── generation.test.ts  # End-to-end: grammar → Zod schemas → validation
    │   │   └── di.test.ts          # DI service integration test
    │   └── fixtures/               # Test .langium grammar fixtures
    │       ├── simple.langium      # Basic types: string, number, boolean, fragments
    │       ├── hierarchy.langium   # Inheritance + unions
    │       ├── crossref.langium    # Cross-references
    │       └── recursive.langium   # Recursive/circular types
    ├── package.json
    └── tsconfig.json
```

**Structure Decision**: Single package (`langium-zod`) in the monorepo. The `x-to-zod` library is already published on npm (v0.7.0) with a fluent builder API (`build.string()`, `build.object()`, etc.) and is consumed as an npm dependency. The IR (`ZodTypeDescriptor`) is internal to `langium-zod`.

## Architecture Overview

### Data Flow

```
┌─────────────┐    collectAst()    ┌────────────┐   extractor.ts   ┌──────────────────┐
│   Langium    │ ────────────────> │  AstTypes   │ ──────────────> │ ZodTypeDescriptor │
│   Grammar    │                   │ interfaces  │                  │       IR[]        │
│  (.langium)  │                   │   unions    │                  └────────┬─────────┘
└─────────────┘                    └────────────┘                           │
                                                               generator.ts │ x-to-zod
                                                               builder API  │ build.*().text()
                                                                            │
                                                                   ┌────────▼─────────┐
                                                                   │  zod-schemas.ts   │
                                                                   │  (Zod 4.x code)  │
                                                                   └──────────────────┘
```

### Key Transformation Steps

1. **Extract** (`extractor.ts`): Call `collectAst(grammar)` to get `AstTypes`. Transform each `InterfaceType` and `UnionType` into `ZodTypeDescriptor[]`.

2. **Map Types** (`type-mapper.ts`): Convert Langium property types to `ZodTypeExpression`:
   - String terminals (`ID`, `STRING`, data type rules returning string) → `{ kind: "primitive", primitive: "string" }`
   - Number terminals (`INT`) → `{ kind: "primitive", primitive: "number" }`
   - Boolean assignments (`?=`) → `{ kind: "primitive", primitive: "boolean" }`
   - AST type references → `{ kind: "reference", typeName }`
   - Cross-references (`[Type]`) → `{ kind: "crossReference", targetType }`
   - Arrays (`+=`) → `{ kind: "array", element }`
   - Add `$type` literal → `{ kind: "literal", value: typeName }`

3. **Detect Recursion** (`recursion-detector.ts`): Build a dependency graph of type references. Find cycles using DFS. Mark recursive edges for lazy evaluation.

4. **Generate** (`generator.ts` via `x-to-zod` builder API): Take `ZodTypeDescriptor[]` and produce Zod 4.x TypeScript source:
   - Objects use `z.looseObject({...})`
   - Unions use `z.discriminatedUnion("$type", [...])`
   - Recursive references use getter pattern
   - Cross-references use shared `ReferenceSchema`

### Zod 4.x Output Patterns

```typescript
// Object type with passthrough
export const AdditionSchema = z.looseObject({
  $type: z.literal("Addition"),
  left: ExpressionSchema,       // non-recursive reference
  operator: z.string(),
  right: ExpressionSchema,
});

// Discriminated union
export const ExpressionSchema = z.discriminatedUnion("$type", [
  AdditionSchema,
  MultiplicationSchema,
  NumberLiteralSchema,
]);

// Recursive type (getter pattern)
export const TreeNodeSchema = z.looseObject({
  $type: z.literal("TreeNode"),
  name: z.string(),
  get children() { return z.array(TreeNodeSchema); },
});

// Cross-reference
export const ReferenceSchema = z.looseObject({
  $refText: z.string(),
  ref: z.optional(z.unknown()),
});

export const VariableRefSchema = z.looseObject({
  $type: z.literal("VariableRef"),
  variable: ReferenceSchema,
});
```

## Complexity Tracking

No constitution violations to justify. The single-package structure uses the published x-to-zod library as an npm dependency, following the established monorepo pattern.
