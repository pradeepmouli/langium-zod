# Tasks: Langium Zod Generator Plugin

**Input**: Design documents from `/specs/001-langium-zod-plugin/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/generator-api.md

**Tests**: Included — monorepo requires tests for all packages (vitest, 80% coverage thresholds).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Architecture Note**: The plan originally envisioned two monorepo packages (`packages/x-to-zod/` and `packages/langium-zod/`). However, `x-to-zod` is already published on npm (v0.7.0) with a fluent builder API (`build.string()`, `build.object()`, etc.) that produces Zod code strings via `.text()`. The langium-zod package will use this builder API directly — no need for a separate `packages/x-to-zod/` package. The IR (`ZodTypeDescriptor`) is internal to langium-zod.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo package**: `packages/langium-zod/src/`, `packages/langium-zod/test/`
- **Test grammars**: `packages/langium-zod/test/fixtures/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the langium-zod package within the monorepo and configure build tooling.

- [X] T001 Create `packages/langium-zod/` directory structure with `src/` and `test/unit/` and `test/integration/` and `test/fixtures/` subdirectories
- [X] T002 Create `packages/langium-zod/package.json` with name `@pradeepmouli/langium-zod`, type `module`, dependencies on `langium` (^4.0.0), `x-to-zod` (^0.7.0), and `zod` (^4.0.0), devDependencies on `vitest` and `typescript`, scripts for `build`, `test`, `type-check`, and `clean`
- [X] T003 Create `packages/langium-zod/tsconfig.json` extending root tsconfig with `outDir: "./dist"`, `rootDir: "./src"`, composite mode, and ESM module settings
- [X] T004 [P] Move `x-to-zod` dependency from root `package.json` to `packages/langium-zod/package.json` (remove from root dependencies)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define the intermediate representation (IR) types, configuration, and error classes that ALL user stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Define IR types (`ZodTypeDescriptor`, `ZodPropertyDescriptor`, `ZodTypeExpression` discriminated union with variants: `primitive`, `literal`, `reference`, `array`, `crossReference`, `union`, `lazy`) in `packages/langium-zod/src/types.ts` — see data-model.md for full schema
- [X] T006 [P] Define `ZodGeneratorConfig` interface (`grammar`, `services?`, `include?`, `exclude?`, `outputPath?`) and `FilterConfig` interface with default values in `packages/langium-zod/src/config.ts` — see contracts/generator-api.md
- [X] T007 [P] Define `ZodGeneratorError` class extending `Error` with `grammarElement?`, `typeName?`, and `suggestion?` properties in `packages/langium-zod/src/errors.ts` — see contracts/generator-api.md

**Checkpoint**: IR types, config, and error infrastructure ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Generate Zod Schemas from Grammar (Priority: P1) MVP

**Goal**: Run the generator against a Langium grammar and produce Zod validation schemas for each AST node type, mapping `=` to appropriate primitives, `?=` to `z.boolean()`, `+=` to `z.array()`, and optional properties to `z.optional()`.

**Independent Test**: Run generator against `simple.langium` test fixture → verify Zod schemas are produced for each type → import schemas and validate AST node objects (valid passes, invalid fails with descriptive errors).

**Acceptance**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-009, FR-018, FR-019

> **Note**: FR-011 (recursion), FR-012 (fragments), and FR-013 (actions) are exercised via `collectAst()` in this phase but have dedicated test coverage in Phase 8 (T037, T038).

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T008 [P] [US1] Create test grammar fixture `packages/langium-zod/test/fixtures/simple.langium` with basic parser rules: a `Greeting` type with `name: ID` (string), `count: INT` (number), `active?=true` (boolean), `tags+=Tag` (array), an optional property `description: STRING` not assigned in all alternatives, and a `fragment CommonProps` contributing a `source: STRING` property to at least one rule (exercises FR-012 fragment handling)
- [X] T009 [P] [US1] Unit test for type-mapper in `packages/langium-zod/test/unit/type-mapper.test.ts` — test mapping of: `ID`→`z.string()`, `STRING`→`z.string()`, `INT`→`z.number()`, `?=`→`z.boolean()`, `+=`→`z.array()`, data type rules→underlying primitive, AST type reference→reference expression, optional properties→optional wrapper
- [X] T010 [P] [US1] Unit test for extractor in `packages/langium-zod/test/unit/extractor.test.ts` — test: `InterfaceType` transforms to `ZodTypeDescriptor` with kind `"object"`, properties include `$type` literal, property count matches, optional flags preserved
- [X] T011 [P] [US1] Unit test for recursion-detector in `packages/langium-zod/test/unit/recursion-detector.test.ts` — test: non-recursive types return empty set, self-referencing type detected, mutual recursion (A→B→A) detected, diamond dependency (non-circular) not flagged
- [X] T012 [US1] Integration test in `packages/langium-zod/test/integration/generation.test.ts` — test: load `simple.langium`, run `generateZodSchemas()`, verify output is valid TypeScript containing `z.looseObject()` schemas, `z.literal()` for `$type`, `z.string()`/`z.number()`/`z.boolean()` for primitives, `z.array()` for arrays, `z.optional()` for optional properties; eval and validate mock AST nodes

### Implementation for User Story 1

- [X] T013 [P] [US1] Implement `mapPropertyType()` in `packages/langium-zod/src/type-mapper.ts` — convert Langium `PropertyType` to `ZodTypeExpression`: string terminals (`ID`, `STRING`, string data type rules) → `{ kind: "primitive", primitive: "string" }`, `INT` → `{ kind: "primitive", primitive: "number" }`, boolean assignments → `{ kind: "primitive", primitive: "boolean" }`, AST type references → `{ kind: "reference", typeName }`, arrays → `{ kind: "array", element }`. Handle data type rules by tracing to underlying primitive. Include `mapTerminalToZod()` helper.
- [X] T014 [P] [US1] Implement `detectRecursiveTypes()` in `packages/langium-zod/src/recursion-detector.ts` — build a directed dependency graph from `ZodTypeDescriptor[]` (edges from type references), run DFS-based cycle detection, return `Set<string>` of type names involved in cycles. Mark which specific property edges are recursive.
- [X] T015 [US1] Implement `extractTypeDescriptors()` in `packages/langium-zod/src/extractor.ts` — call Langium's `collectAst(grammar)` to get `AstTypes`, iterate `interfaces` array, transform each `InterfaceType` to `ZodTypeDescriptor` with kind `"object"`, map each property via `mapPropertyType()`, add `$type: z.literal(name)` property, set optional flags. Exclude `$`-prefixed properties except `$type`. **Note**: `collectAst()` transparently resolves fragments (FR-012) and grammar actions/`{infer}` types (FR-013) — they appear as regular `InterfaceType` entries with properties already flattened, so no special handling is required beyond iterating the `interfaces` array.
- [X] T016 [US1] Implement `generateZodCode()` in `packages/langium-zod/src/generator.ts` — take `ZodTypeDescriptor[]` and `Set<string>` recursive types, use `x-to-zod` builder API (`build.object()`, `build.string()`, `build.number()`, `build.boolean()`, `build.literal()`, `build.array()`) to construct Zod schema code; use `z.looseObject()` for passthrough mode (FR-019); apply getter pattern for recursive properties; output complete TypeScript file with `import { z } from "zod"` header and named exports (`export const <Name>Schema = ...`).
- [X] T017 [US1] Implement `generateZodSchemas()` public API in `packages/langium-zod/src/index.ts` — orchestrate: validate config → extract type descriptors → detect recursion → generate code → return TypeScript source string. Export `generateZodSchemas`, `extractTypeDescriptors`, `ZodGeneratorConfig`, `ZodGeneratorError`, and all IR types.

**Checkpoint**: User Story 1 complete. Generator produces valid Zod schemas for basic Langium grammars with primitives, arrays, optional properties, and the `$type` discriminator. Recursive types handled via getter pattern.

---

## Phase 4: User Story 2 — Handle Type Hierarchy and $type Discriminator (Priority: P2)

**Goal**: Support interface inheritance (subtype includes parent properties) and union types (`type X = A | B`) as `z.discriminatedUnion("$type", [...])`.

**Independent Test**: Run generator against `hierarchy.langium` → verify subtypes include inherited properties, union types produce discriminated unions, validation accepts valid subtypes and rejects invalid `$type` values.

**Acceptance**: FR-007, FR-008, FR-018

### Tests for User Story 2

- [X] T018 [P] [US2] Create test grammar fixture `packages/langium-zod/test/fixtures/hierarchy.langium` with: base interface `Element` (name: ID), interface `Entity extends Element` (features: Feature[]), declared union `type AbstractElement = Entity | DataType`, and `DataType extends Element`
- [X] T019 [P] [US2] Unit test for inheritance extraction in `packages/langium-zod/test/unit/extractor.test.ts` — test: `Entity` descriptor includes `name` from parent `Element` plus its own `features`, `$type` literal is `"Entity"` not `"Element"`
- [X] T020 [P] [US2] Unit test for union extraction in `packages/langium-zod/test/unit/extractor.test.ts` — test: `AbstractElement` produces `ZodTypeDescriptor` with kind `"union"`, members `["Entity", "DataType"]`, discriminator `"$type"`

### Implementation for User Story 2

- [X] T021 [US2] Extend `extractTypeDescriptors()` in `packages/langium-zod/src/extractor.ts` to flatten inherited properties from `InterfaceType.superTypes` into subtype descriptors, resolving the full property set for each concrete type
- [X] T022 [US2] Extend `extractTypeDescriptors()` in `packages/langium-zod/src/extractor.ts` to transform `UnionType` entries from `AstTypes.unions` into `ZodTypeDescriptor` with kind `"union"`, extracting member type names from the union's type definition
- [X] T023 [US2] Extend `generateZodCode()` in `packages/langium-zod/src/generator.ts` to emit `z.discriminatedUnion("$type", [MemberSchema1, MemberSchema2, ...])` for union type descriptors, ensuring member schemas are emitted before the union schema in topological order
- [X] T024 [US2] Integration test in `packages/langium-zod/test/integration/generation.test.ts` — test: load `hierarchy.langium`, generate schemas, verify `EntitySchema` includes inherited `name` property, `AbstractElementSchema` is a discriminated union, validate mock AST nodes with correct/incorrect `$type` values

**Checkpoint**: User Stories 1 AND 2 complete. Generator handles inheritance, union types, and $type discriminated unions.

---

## Phase 5: User Story 3 — Handle Cross-References (Priority: P3)

**Goal**: Map cross-reference properties (`[Type]` syntax) to a `ReferenceSchema` that validates `{ $refText: string, ref?: unknown }`.

**Independent Test**: Run generator against `crossref.langium` → verify cross-ref properties use `ReferenceSchema`, validation accepts resolved and unresolved references, rejects missing `$refText`.

**Acceptance**: FR-010

### Tests for User Story 3

- [X] T025 [P] [US3] Create test grammar fixture `packages/langium-zod/test/fixtures/crossref.langium` with: `Variable` type (name: ID), `VariableRef` type with `variable=[Variable]` cross-reference property
- [X] T026 [P] [US3] Unit test for cross-reference type mapping in `packages/langium-zod/test/unit/type-mapper.test.ts` — test: cross-reference property type maps to `{ kind: "crossReference", targetType: "Variable" }`

### Implementation for User Story 3

- [X] T027 [US3] Extend `mapPropertyType()` in `packages/langium-zod/src/type-mapper.ts` to detect cross-reference properties (via `isCrossReference` flag or `Reference<T>` type pattern) and return `{ kind: "crossReference", targetType }`
- [X] T028 [US3] Extend `generateZodCode()` in `packages/langium-zod/src/generator.ts` to emit a shared `ReferenceSchema = z.looseObject({ $refText: z.string(), ref: z.optional(z.unknown()) })` at the top of the output, and reference it for all cross-reference properties
- [X] T029 [US3] Integration test in `packages/langium-zod/test/integration/generation.test.ts` — test: load `crossref.langium`, generate schemas, verify `VariableRefSchema` references `ReferenceSchema`, validate unresolved ref (has `$refText`, no `ref`), resolved ref (has both), and invalid ref (missing `$refText`)

**Checkpoint**: User Stories 1, 2, AND 3 complete. Generator handles all core Langium type system features.

---

## Phase 6: User Story 4 — Integrate with Langium DI and Generator Pipeline (Priority: P4)

**Goal**: Register the generator as a Langium DI service so it runs alongside other generation artifacts.

**Independent Test**: Configure plugin in a test DI module → run generation via service → verify Zod schemas appear in output.

**Acceptance**: FR-014

### Tests for User Story 4

- [X] T030 [P] [US4] Integration test in `packages/langium-zod/test/integration/di.test.ts` — test: create Langium services with `ZodSchemaGeneratorModule` injected, invoke `services.ZodSchemaGenerator.generate(grammar)`, verify valid Zod schema output

### Implementation for User Story 4

- [X] T031 [US4] Implement `DefaultZodSchemaGenerator` class in `packages/langium-zod/src/di.ts` — wraps `generateZodSchemas()` as a Langium service with `generate(grammar, config?)` method, receives `LangiumCoreServices` via constructor injection
- [X] T032 [US4] Create `ZodSchemaGeneratorModule` in `packages/langium-zod/src/di.ts` — Langium `Module` that registers `DefaultZodSchemaGenerator` under `shared.ZodSchemaGenerator`
- [X] T033 [US4] Export DI types (`ZodSchemaGenerator` interface, `ZodSchemaGeneratorModule`, `DefaultZodSchemaGenerator`) from `packages/langium-zod/src/index.ts`

**Checkpoint**: User Stories 1–4 complete. Generator integrates with Langium's DI system.

---

## Phase 7: User Story 5 — Selective Schema Generation (Priority: P5)

**Goal**: Allow include/exclude configuration to control which AST types produce Zod schemas.

**Independent Test**: Configure include/exclude lists → run generator → verify only specified types produce schemas.

**Acceptance**: FR-015

### Tests for User Story 5

- [X] T034 [P] [US5] Unit test for include/exclude filtering in `packages/langium-zod/test/unit/extractor.test.ts` — test: include only `["Entity"]` → only Entity descriptor returned; exclude `["DataType"]` → all except DataType; no config → all types returned

### Implementation for User Story 5

- [X] T035 [US5] Implement include/exclude filtering in `extractTypeDescriptors()` in `packages/langium-zod/src/extractor.ts` — apply `FilterConfig.include` (whitelist) and `FilterConfig.exclude` (blacklist) before transformation; include takes precedence if both set; union types auto-filter members based on available concrete types
- [X] T036 [US5] Integration test in `packages/langium-zod/test/integration/generation.test.ts` — test: load `hierarchy.langium`, generate with `include: ["Entity"]`, verify only `EntitySchema` in output; generate with `exclude: ["DataType"]`, verify `DataType` absent but others present

**Checkpoint**: All 5 user stories complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, robustness, and validation across all user stories.

- [X] T037 [P] Create test grammar fixture `packages/langium-zod/test/fixtures/recursive.langium` with self-referencing type (`TreeNode` with `children: TreeNode[]`) and mutual recursion (`A` references `B`, `B` references `A`), plus integration test verifying getter-based lazy evaluation in output
- [X] T038 [P] Add error handling integration test in `packages/langium-zod/test/integration/generation.test.ts` — test: unmappable property type produces `ZodGeneratorError` with `typeName` and `suggestion`; generated schemas produce descriptive validation errors (FR-016, FR-017)
- [X] T039 Run full test suite (`pnpm test`) and lint (`pnpm lint`) from repo root, fix any failures
- [X] T040 Validate quickstart.md scenarios: verify programmatic API usage example works end-to-end with a real Langium grammar

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3–7)**: All depend on Foundational phase completion
  - US1 (P1): Must complete first — provides core generator that all later stories extend
  - US2 (P2): Depends on US1 (extends extractor and generator)
  - US3 (P3): Depends on US1 (extends type-mapper and generator)
  - US4 (P4): Depends on US1 (wraps generateZodSchemas in DI)
  - US5 (P5): Depends on US1 (adds filtering to extractor)
  - US2, US3, US4, US5 are independent of each other and can proceed in parallel after US1
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1/MVP)
                                                 ├→ Phase 4 (US2) ──┐
                                                 ├→ Phase 5 (US3) ──┤
                                                 ├→ Phase 6 (US4) ──├→ Phase 8 (Polish)
                                                 └→ Phase 7 (US5) ──┘
```

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Type definitions/IR before mappers
- Mappers before extractor
- Extractor before generator
- Generator before public API
- Unit tests before integration tests
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T004 (move dep) runs in parallel with T001-T003
- **Phase 2**: T005, T006, T007 all run in parallel (different files)
- **Phase 3 (US1)**: T008-T011 (test fixtures + unit tests) run in parallel; T013-T014 (type-mapper + recursion-detector) run in parallel
- **Phase 4 (US2)**: T018-T020 (fixture + unit tests) run in parallel
- **Phase 5 (US3)**: T025-T026 (fixture + unit test) run in parallel
- **Phase 6 (US4)**: T030 (test) runs before T031-T033 (impl)
- **Phase 7 (US5)**: T034 (test) runs before T035-T036 (impl)
- **After US1**: US2, US3, US4, US5 can all proceed in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all test fixtures and unit tests in parallel:
Task: "Create simple.langium fixture in test/fixtures/simple.langium"
Task: "Unit test for type-mapper in test/unit/type-mapper.test.ts"
Task: "Unit test for extractor in test/unit/extractor.test.ts"
Task: "Unit test for recursion-detector in test/unit/recursion-detector.test.ts"

# Then launch parallelizable implementation:
Task: "Implement type-mapper.ts in src/type-mapper.ts"
Task: "Implement recursion-detector.ts in src/recursion-detector.ts"

# Then sequential (depends on above):
Task: "Implement extractor.ts in src/extractor.ts"
Task: "Implement generator.ts in src/generator.ts"
Task: "Create public API in src/index.ts"

# Finally integration test:
Task: "Integration test for simple grammar in test/integration/generation.test.ts"
```

---

## Parallel Example: After US1 Completes

```bash
# All four remaining user stories can launch in parallel:
Task: "[US2] Extend extractor for inheritance in src/extractor.ts"
Task: "[US3] Extend type-mapper for cross-refs in src/type-mapper.ts"
Task: "[US4] Implement DI service in src/di.ts"
Task: "[US5] Add include/exclude filtering in src/extractor.ts"
```

Note: US2 and US5 both modify `extractor.ts` — if running in parallel, coordinate to avoid conflicts.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test US1 independently — run generator against `simple.langium`, verify valid Zod output, validate AST nodes
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → MVP!
3. Add User Story 2 → Type hierarchy + discriminated unions
4. Add User Story 3 → Cross-references
5. Add User Story 4 → DI integration
6. Add User Story 5 → Selective generation
7. Each story adds value without breaking previous stories

---

## Summary

| Metric | Value |
|--------|-------|
| **Total tasks** | 40 |
| **Phase 1 (Setup)** | 4 tasks |
| **Phase 2 (Foundational)** | 3 tasks |
| **Phase 3 (US1 — MVP)** | 10 tasks |
| **Phase 4 (US2)** | 7 tasks |
| **Phase 5 (US3)** | 5 tasks |
| **Phase 6 (US4)** | 4 tasks |
| **Phase 7 (US5)** | 3 tasks |
| **Phase 8 (Polish)** | 4 tasks |
| **Parallel opportunities** | 18 tasks marked [P] |
| **Suggested MVP scope** | Phases 1–3 (US1 only, 17 tasks) |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Tests written first and verified to fail before implementation
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- `x-to-zod` builder API: `build.string()`, `build.object()`, `build.literal()`, `build.array()`, etc. → `.text()` produces Zod code strings
- Zod 4.x patterns: `z.looseObject()` (passthrough), `z.discriminatedUnion("$type", [...])` (unions), getter pattern (recursion)
