# Feature Specification: Langium Zod Generator Plugin

**Feature Branch**: `001-langium-zod-plugin`
**Created**: 2026-02-20
**Status**: Draft
**Input**: User description: "Create a Langium generator plugin that derives Zod validation schemas from grammar definitions, enabling runtime validation of AST nodes in Langium-based language tools"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate Zod Schemas from Grammar (Priority: P1)

As a language developer using Langium, I want to run the generator plugin against my Langium grammar definition and receive Zod validation schemas for each AST node type, so that I can validate parsed AST nodes at runtime.

Langium grammars define parser rules that produce AST node types as TypeScript interfaces. These types only exist at compile time. This plugin bridges that gap by generating Zod schemas that mirror the generated AST types, enabling runtime validation of AST node objects.

**Why this priority**: This is the core value proposition. Without schema generation from grammar definitions, no other feature matters. A language developer who can generate schemas from their grammar has an immediately useful tool for runtime AST validation.

**Independent Test**: Can be fully tested by running the generator against a sample Langium grammar file (`.langium`) and verifying that valid Zod schema files are produced for each defined AST type. The generated schemas can be imported and used to validate AST node objects.

**Acceptance Scenarios**:

1. **Given** a Langium grammar with parser rules that define AST types, **When** the generator plugin is executed, **Then** a Zod schema is produced for each AST type with all properties correctly mapped to Zod validators.
2. **Given** a grammar with `=` assignments that produce single-value properties (string via terminal rules like `ID` or `STRING`, number via `INT`), **When** the generator runs, **Then** the corresponding Zod schemas use z.string() for string terminals and z.number() for numeric terminals.
3. **Given** a grammar with `?=` (boolean) assignments, **When** the generator runs, **Then** the corresponding property is mapped to z.boolean() in the generated schema.
4. **Given** a grammar with `+=` (array) assignments, **When** the generator runs, **Then** the corresponding Zod schemas wrap the element type in z.array().
5. **Given** a grammar where a property is not always assigned in every alternative of a rule, **When** the generator runs, **Then** that property is marked as optional in the Zod schema.
6. **Given** a valid AST node matching a grammar type, **When** the generated Zod schema parses it, **Then** parsing succeeds and returns the validated object.
7. **Given** an invalid AST node with missing required properties or wrongly-typed values, **When** the generated Zod schema parses it, **Then** parsing fails with descriptive error messages identifying the invalid fields.

---

### User Story 2 - Handle Langium Type Hierarchy and $type Discriminator (Priority: P2)

As a language developer, I want the generated Zod schemas to correctly represent Langium's type system including union types (declared with `type X = A | B`), interface inheritance, and the `$type` discriminator property, so that schemas accurately reflect the grammar's AST type hierarchy.

In Langium 4.x, every AST node has a `$type` property that identifies its concrete type. Union types are declared in grammars and interface inheritance is supported via the `extends` keyword. The generated Zod schemas must reflect this type system.

**Why this priority**: Real-world Langium grammars rely heavily on type inheritance and union types. Without support for the type hierarchy and the `$type` discriminator, the plugin would only work for trivially simple grammars.

**Independent Test**: Can be fully tested by creating a grammar with inheritance chains, union types (using `type` declarations), and the `$type` discriminator, running the generator, and verifying the schemas correctly validate instances of subtypes and reject invalid type combinations.

**Acceptance Scenarios**:

1. **Given** a grammar where interface B extends interface A, **When** the generator runs, **Then** the schema for B includes all properties from A plus B's own properties, and the `$type` literal is set to B's type name.
2. **Given** a grammar with a declared union type (e.g., `type Expression = Addition | Multiplication`), **When** the generator runs, **Then** a discriminated union schema is produced using the `$type` property as the discriminator.
3. **Given** an AST node of a subtype with a valid `$type` value, **When** validated against the parent type's union schema, **Then** validation succeeds.
4. **Given** an AST node with an invalid or missing `$type` value, **When** validated against a union schema, **Then** validation fails with a clear error.
5. **Given** a grammar using both inferred types (from parser rules) and declared types (explicit `interface` and `type` declarations), **When** the generator runs, **Then** schemas are produced for both inferred and declared types.

---

### User Story 3 - Handle Cross-References (Priority: P3)

As a language developer, I want the generator to handle cross-reference properties in my grammar (declared with `[Type]` or `[Type:TOKEN]` syntax), so that schemas can validate the Reference structure without requiring full scope resolution.

In Langium, cross-references produce `Reference<T>` objects at runtime. These contain a `$refText` string (the textual reference) and optionally a `ref` property pointing to the resolved target node. The Zod schema should validate this reference structure.

**Why this priority**: Cross-references are a fundamental Langium feature used in most real-world grammars for linking between AST nodes. Supporting them makes the plugin practical for production use cases.

**Independent Test**: Can be fully tested by creating a grammar with cross-reference properties, generating schemas, and verifying that Reference objects (both resolved and unresolved) pass validation appropriately.

**Acceptance Scenarios**:

1. **Given** a grammar with a cross-reference property (e.g., `element=[Element]`), **When** the generator runs, **Then** the schema for that property validates a Reference structure containing `$refText` (string) and an optional `ref` property.
2. **Given** an unresolved cross-reference (has `$refText` but `ref` is undefined), **When** the schema validates it, **Then** validation succeeds.
3. **Given** a cross-reference where `ref` is present and points to a valid target type, **When** the schema validates it, **Then** validation succeeds.
4. **Given** a Reference object missing the required `$refText` property, **When** the schema validates it, **Then** validation fails.

---

### User Story 4 - Integrate with Langium CLI and Generator Pipeline (Priority: P4)

As a language developer, I want to plug the Zod schema generator into Langium's dependency injection system and CLI generation pipeline, so that schemas are automatically regenerated alongside other artifacts when I run `langium generate` or my project's build process.

Langium's architecture uses dependency injection (DI) for all services. The plugin should register as a service that can be invoked during the language generation lifecycle, either through the Langium CLI or programmatically.

**Why this priority**: Seamless integration with existing Langium tooling reduces friction and ensures schemas stay in sync with the grammar. However, the generator can still be used as a standalone function, so this is a convenience enhancement.

**Independent Test**: Can be fully tested by configuring the plugin in a Langium project's DI module, running the standard Langium generation process, and verifying Zod schemas appear alongside other generated artifacts in `src/generated/`.

**Acceptance Scenarios**:

1. **Given** a Langium project with the plugin registered in the DI module, **When** the language generation process runs, **Then** Zod schemas are generated alongside other artifacts (ast.ts, grammar, module).
2. **Given** a grammar change that adds a new AST type, **When** regeneration runs, **Then** a new Zod schema is generated for the added type.
3. **Given** a grammar change that removes an AST type, **When** regeneration runs, **Then** the corresponding Zod schema is no longer present in the generated output.

---

### User Story 5 - Selective Schema Generation (Priority: P5)

As a language developer, I want to control which grammar rules and AST types produce Zod schemas, so that I can avoid generating schemas for internal or irrelevant AST nodes and keep the generated output focused.

**Why this priority**: Large grammars can produce many AST types, not all of which need runtime validation. Selective generation keeps the output manageable, reduces bundle size, and lets developers focus on the types they care about.

**Independent Test**: Can be fully tested by configuring include/exclude patterns and verifying that only the specified types produce schemas.

**Acceptance Scenarios**:

1. **Given** a configuration that includes only specific AST type names, **When** the generator runs, **Then** only those types produce Zod schemas.
2. **Given** a configuration that excludes specific AST type names, **When** the generator runs, **Then** all types except the excluded ones produce schemas.
3. **Given** no include/exclude configuration, **When** the generator runs, **Then** schemas are generated for all AST types (default behavior).

---

### Edge Cases

- What happens when a grammar contains recursive/circular type references (e.g., a tree structure where a `Node` has children of type `Node`)? Schemas must handle recursive types using lazy evaluation to avoid infinite loops.
- What happens when the grammar is syntactically invalid or fails to parse? The generator should fail gracefully with an actionable error message rather than producing partial or incorrect output.
- What happens when a grammar uses Langium's built-in terminal rules (`ID`, `INT`, `STRING`)? These should map to appropriate Zod primitives (string for `ID`/`STRING`, number for `INT`).
- What happens when a grammar uses data type rules (parser rules that return primitive types)? These should be traced to their underlying primitive type for Zod mapping.
- What happens when a property appears in some alternatives of a parser rule but not others? It should be treated as optional in the generated schema.
- What happens when a grammar uses actions (e.g., `{infer NewType}`) to create new AST types mid-rule? These inferred types should also produce Zod schemas.
- What happens when a grammar uses fragments? Fragments do not produce AST types themselves but contribute properties to the rules that use them. The generator should incorporate fragment properties into the consuming rule's schema without creating a separate schema for the fragment.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The plugin MUST parse Langium grammar definitions (`.langium` files) and extract all AST node type information including parser rules, declared interfaces, declared union types, and their properties.
- **FR-002**: The plugin MUST generate all Zod schema definitions into a single output file (e.g., `zod-schemas.ts`) mirroring Langium's single-file `ast.ts` pattern, with named exports for each schema.
- **FR-003**: The plugin MUST map Langium's three assignment operators to Zod types: `=` assignments to the corresponding Zod primitive or object type, `?=` assignments to z.boolean(), and `+=` assignments to z.array() of the element type.
- **FR-004**: The plugin MUST map Langium built-in terminal rules to Zod primitives: `ID` and `STRING` to z.string(), `INT` to z.number().
- **FR-005**: The plugin MUST map data type rules to their underlying primitive types for Zod schema generation.
- **FR-006**: The plugin MUST mark properties that are not always assigned across all alternatives as optional in the generated schema.
- **FR-007**: The plugin MUST support Langium's type inheritance by including all inherited properties in the subtype's schema.
- **FR-008**: The plugin MUST generate discriminated union schemas for Langium union types, using the `$type` property as the discriminator.
- **FR-009**: The plugin MUST include a `$type` literal string property in every generated AST node schema, matching the Langium convention where every AST node has a `$type` discriminator. Other Langium internal `$`-prefixed metadata properties (`$container`, `$containerProperty`, `$containerIndex`, `$cstNode`, `$document`) MUST be excluded from generated schemas.
- **FR-010**: The plugin MUST handle cross-reference properties by generating a schema that validates a Reference structure (containing `$refText` and optional `ref`).
- **FR-011**: The plugin MUST handle recursive/circular type references using lazy evaluation in the generated schemas.
- **FR-012**: The plugin MUST handle grammar fragments by incorporating fragment properties into the schemas of the rules that use them, without creating separate schemas for fragments.
- **FR-013**: The plugin MUST handle grammar actions that create AST types mid-rule by generating schemas for those inferred types.
- **FR-014**: The plugin MUST integrate with Langium's dependency injection system, registerable as a service in a Langium project's DI module.
- **FR-015**: The plugin MUST support configuration for including or excluding specific AST types from schema generation.
- **FR-016**: The plugin MUST provide clear, actionable error messages when schema generation fails, indicating which grammar element caused the issue.
- **FR-017**: The plugin MUST generate schemas that produce descriptive validation error messages identifying which properties failed and why.
- **FR-018**: The plugin MUST support both inferred types (from parser rules) and declared types (explicit `interface` and `type` declarations in the grammar).

### Key Entities

- **Grammar Definition**: A `.langium` file defining the language's syntax and AST structure. Contains parser rules, terminal rules, data type rules, declared interfaces, declared union types, fragments, and actions.
- **AST Node Type**: A TypeScript interface representing a parsed syntax tree node. Derived from parser rules or declared interfaces. Has a `$type` discriminator property, typed properties from assignments, and participates in inheritance and union relationships.
- **Zod Schema**: A generated Zod object schema corresponding to an AST node type. Encodes the type's `$type` literal, property types, optionality, and relationships for runtime validation.
- **Cross-Reference (Reference)**: A grammar property declared with `[Type]` or `[Type:TOKEN]` syntax. At runtime, produces a `Reference<T>` object containing `$refText` (the textual reference string) and optionally `ref` (the resolved target node).
- **Type Hierarchy**: The inheritance and union relationships between AST types. Subtypes extend parent interfaces; union types (declared with `type X = A | B`) group related types under a single discriminated union.
- **Generator Configuration**: Settings controlling which AST types produce schemas, output location, and generation behavior. Integrated into the Langium DI module.
- **Grammar Fragment**: A reusable grammar rule (declared with `fragment`) that contributes properties to other rules without producing its own AST type.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Given any valid Langium grammar, the plugin generates Zod schemas for 100% of AST node types (unless explicitly excluded by configuration).
- **SC-002**: All generated schemas successfully validate correctly-formed AST nodes (including `$type` discriminator) and reject malformed ones with descriptive error messages.
- **SC-003**: Language developers can integrate the plugin into their Langium project and generate schemas with no more than 3 configuration steps (install package, register in DI module, run generation).
- **SC-004**: Generated schemas stay in sync with grammar changes: after regeneration following a grammar modification, all schemas reflect the current grammar with no manual intervention.
- **SC-005**: The plugin handles grammars with at least 50 AST node types without errors or degradation in output quality.
- **SC-006**: Generated schema files are directly importable and usable without additional transformation or manual editing.
- **SC-007**: Validation errors from generated schemas identify the specific property, expected type, and reason for failure, enabling developers to locate and fix issues in their AST data.

## Clarifications

### Session 2026-02-20

- Q: How should generated schemas be organized into files? → A: Single file (e.g., `zod-schemas.ts`) containing all schemas, mirroring Langium's `ast.ts` pattern.
- Q: Should schemas validate Langium's internal `$`-prefixed metadata properties (`$container`, `$cstNode`, `$document`, etc.) beyond `$type`? → A: No. Only `$type` plus grammar-defined properties. Other `$`-prefixed metadata is excluded.

## Assumptions

- The plugin targets Langium version 4.x as the primary supported version, following Langium 4.0's conventions including the `$type` discriminator property and strict grammar mode support.
- Generated schemas are output as TypeScript files (.ts) to align with Langium's TypeScript-first ecosystem.
- The default output directory for generated schemas follows Langium's convention for generated artifacts (typically `src/generated/`).
- Cross-references are validated structurally (validating the Reference object shape with `$refText` and optional `ref`) rather than performing scope resolution, which is a separate Langium concern handled by the ScopeProvider.
- The plugin does not validate semantic constraints beyond structural type correctness (e.g., it validates that a property is a string but not that it matches a particular business rule or naming convention).
- Schema generation is a build-time activity; generated schemas are static artifacts produced during the `langium generate` step or CI/CD pipeline.
- The plugin supports both inferred and declared types, with declared types (strict grammar mode) as the recommended approach for production grammars.
