# Feature Specification: Rune DSL schema generation enhancements

**Feature Branch**: `002-rune-dsl-enhancements`
**Created**: 2026-02-27
**Status**: Draft
**Input**: User description: "Enhancement: Rune DSL Integration — Five Required Additions"

## Clarifications

### Session 2026-02-27

- Q: How should include/exclude overlap be resolved? → A: Apply include first, then exclude; exclude wins on overlap.
- Q: How should unreadable or invalid projection files be handled? → A: Fail fast with a clear error and no output changes.
- Q: How should conformance AST types path be determined? → A: If `--ast-types` is omitted, resolve from `langium-config.json`.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Enforce one-or-more cardinality (Priority: P1)

As a DSL maintainer, I want one-or-more grammar cardinality to be preserved in generated schemas so invalid empty collections are rejected.

**Why this priority**: This is a correctness issue that can silently accept invalid model states.

**Independent Test**: Generate schemas for grammar rules using one-or-more and zero-or-more collection syntax, then validate that only one-or-more collections enforce a minimum length.

**Acceptance Scenarios**:

1. **Given** a grammar collection field with one-or-more cardinality, **When** schemas are generated, **Then** the output requires at least one array item.
2. **Given** a grammar collection field with zero-or-more cardinality, **When** schemas are generated, **Then** the output allows empty arrays.
3. **Given** a grammar collection field without repetition markers, **When** schemas are generated, **Then** the output does not add a minimum-length constraint.

---

### User Story 2 - Filter generated types from CLI (Priority: P1)

As a CLI user, I want include/exclude filtering options in commands so I can limit generated output without creating a separate config file.

**Why this priority**: This removes friction in common workflows and is a low-effort unblocker for adoption.

**Independent Test**: Run generation with include and exclude command options and verify only expected type schemas are emitted, with warning behavior for unknown names.

**Acceptance Scenarios**:

1. **Given** multiple grammar types, **When** generation runs with an include list, **Then** only listed type schemas are emitted.
2. **Given** multiple grammar types, **When** generation runs with an exclude list, **Then** listed type schemas are omitted and all others are emitted.
3. **Given** both config-based and CLI-based include/exclude filters, **When** generation runs, **Then** CLI-provided filters take precedence.
4. **Given** an unknown type name in include or exclude input, **When** generation runs, **Then** processing continues and a warning lists available type names.

---

### User Story 3 - Generate form-surface schemas (Priority: P1)

As a visual editor integrator, I want projection controls that remove internal fields and keep only editable fields so generated schemas match form payloads.

**Why this priority**: Form integration depends on this capability for clean validation surfaces.

**Independent Test**: Run generation with internal-field stripping and projection configuration, then verify each type contains only expected fields plus type identity metadata.

**Acceptance Scenarios**:

1. **Given** internal AST metadata fields, **When** generation runs with internal stripping enabled, **Then** all specified internal fields are removed from every schema.
2. **Given** a projection configuration for a type, **When** generation runs, **Then** only explicitly listed fields (plus type identity metadata) are retained for that type.
3. **Given** a type not listed in projection type rules, **When** generation runs, **Then** default stripping rules apply and all remaining grammar-defined fields are kept.
4. **Given** unknown fields in projection configuration, **When** generation runs, **Then** unknown entries are skipped with warnings and generation still succeeds.

---

### User Story 4 - Verify schema/type conformance (Priority: P2)

As a library maintainer, I want an optional conformance artifact that asserts assignability between generated schemas and AST type declarations so drift is detected during type-checking.

**Why this priority**: This is a safety net that prevents unnoticed breakage as grammars evolve.

**Independent Test**: Generate schemas and a conformance artifact, run type-checking, then simulate drift by changing a type source without regenerating conformance and verify a type failure is reported.

**Acceptance Scenarios**:

1. **Given** conformance generation is enabled with a valid AST type source path, **When** generation runs, **Then** a conformance artifact is produced alongside schema output.
2. **Given** schema and AST declarations are in sync, **When** type-checking runs, **Then** conformance checks pass without errors.
3. **Given** schema and AST declarations drift out of sync, **When** type-checking runs, **Then** conformance checks fail for impacted types.
4. **Given** conformance generation is enabled without an explicit AST type source path, **When** generation runs, **Then** the AST type path is resolved from `langium-config.json`.
5. **Given** a generated schema with no matching AST type export, **When** conformance is generated, **Then** that type is skipped with a warning and processing continues.
6. **Given** conformance generation is enabled and no schemas remain after include/exclude filtering, **When** generation runs, **Then** no conformance file is emitted and a non-fatal warning is shown.

---

### User Story 5 - Validate cross-references at runtime (Priority: P2)

As an editor developer, I want optional cross-reference-aware schema factories and a reusable reference validator so unresolved references can be rejected using live model context.

**Why this priority**: This improves data integrity for reference-heavy models while keeping default generation behavior stable.

**Independent Test**: Generate schemas with cross-reference validation enabled and verify factory-generated schemas accept known references, reject unknown references, and preserve permissive behavior when no reference context is provided.

**Acceptance Scenarios**:

1. **Given** cross-reference validation is disabled, **When** generation runs, **Then** output remains unchanged from baseline generation.
2. **Given** cross-reference validation is enabled, **When** generation runs for types with cross-reference fields, **Then** each impacted type gets a schema factory and reference-context contract.
3. **Given** a schema factory with valid reference values supplied, **When** validation runs, **Then** known references pass and unknown references fail with clear messages.
4. **Given** optional cross-reference fields with empty or undefined values, **When** validation runs, **Then** validation passes.
5. **Given** no reference context is supplied to a schema factory, **When** validation runs, **Then** validation remains permissive to avoid false positives.
6. **Given** projection removes a cross-reference field from a type, **When** generation runs, **Then** no cross-reference refinement is emitted for that removed field.

---

### Edge Cases

- Include and exclude lists both contain the same type name (resolved by applying include first, then exclude; overlap is excluded).
- Include or exclude input contains extra whitespace, duplicate names, or empty entries.
- Projection defaults request removal of fields that do not exist on some types.
- Projection file exists but is malformed or unreadable (generation fails fast with a clear error and does not produce partial output).
- Conformance output path points to a non-writable location.
- Conformance generation is enabled and no AST path can be resolved from CLI input or `langium-config.json`.
- Conformance is enabled while no schemas are generated after filtering (skip conformance emission and issue a non-fatal warning).
- Cross-reference factories are requested for models that have no cross-reference fields.
- Cross-reference values are case-sensitive and do not match due to casing differences.
- Reference collections are large and updated frequently during editor interactions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The generator MUST preserve one-or-more collection cardinality by enforcing a minimum collection size of one in generated schemas.
- **FR-002**: The generator MUST NOT enforce a minimum collection size for zero-or-more or unspecified collection cardinality.
- **FR-003**: The CLI MUST support type inclusion filtering via a comma-separated include option.
- **FR-004**: The CLI MUST support type exclusion filtering via a comma-separated exclude option.
- **FR-005**: CLI include and exclude options MUST override corresponding configuration-file values when both are present.
- **FR-005A**: When include and exclude filters both contain a type, the system MUST apply include first and then exclude so the overlapping type is excluded.
- **FR-006**: Unknown type names in include or exclude filters MUST produce a non-fatal warning that includes available type names.
- **FR-007**: The system MUST support optional global stripping of Langium internal metadata fields from generated schemas.
- **FR-008**: The system MUST support projection rules that keep only selected fields per type while preserving type identity metadata.
- **FR-008A**: Type identity metadata means the `$type` discriminator property, which MUST remain in generated schema surfaces including projected surfaces.
- **FR-009**: Types without explicit projection rules MUST apply projection defaults and otherwise retain grammar-defined fields.
- **FR-010**: Unknown fields in projection rules MUST be ignored with non-fatal warnings.
- **FR-010A**: If the projection configuration file is unreadable or invalid, generation MUST fail fast with a clear error and must not emit or modify output artifacts.
- **FR-011**: The system MUST support optional conformance artifact generation that encodes bidirectional assignability checks between generated schema types and AST type declarations.
- **FR-012**: Conformance generation MUST accept an explicit AST type declaration source path and, when omitted, MUST resolve it from `langium-config.json`.
- **FR-012A**: If conformance generation is enabled and AST type path cannot be resolved from either CLI input or `langium-config.json`, generation MUST fail fast with a clear error.
- **FR-013**: Types missing from AST type exports during conformance generation MUST be skipped with non-fatal warnings.
- **FR-013A**: If conformance generation is enabled and no schemas remain after filtering, the system MUST skip conformance emission and issue a non-fatal warning.
- **FR-014**: The conformance artifact MUST reflect the active schema surface, including any field stripping applied by projection or internal stripping.
- **FR-015**: The system MUST support optional cross-reference-aware schema factories for types that contain cross-reference fields.
- **FR-016**: Cross-reference factories MUST validate references against caller-provided valid target names and fail unknown values with clear messages.
- **FR-017**: Cross-reference validation MUST remain permissive when no reference context is provided to avoid false positives.
- **FR-018**: Optional or empty cross-reference values MUST pass validation.
- **FR-019**: Cross-reference refinements MUST NOT be emitted for fields removed by projection or stripping.
- **FR-020**: The package MUST expose a reusable reference-validation utility for manual schema customization independent of CLI flags.

### Key Entities *(include if feature involves data)*

- **Generation Request**: A user invocation that defines grammar input, output target, filter options, projection options, and optional conformance/cross-reference modes.
- **Type Schema Surface**: The final set of fields retained for a generated type after applying include/exclude filtering and projection/stripping rules.
- **Projection Policy**: A configuration describing default field stripping and optional per-type field allowlists.
- **Conformance Artifact**: A generated type-checking contract that asserts bidirectional assignability between schema-inferred types and AST declarations.
- **Reference Context**: A runtime-provided collection of valid cross-reference target names used for validating reference field values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance tests, 100% of one-or-more collection fields reject empty arrays while zero-or-more and unspecified collection fields continue to accept empty arrays.
- **SC-002**: In CLI filtering acceptance tests, 100% of include/exclude runs emit exactly the expected schema set, and unknown type names always produce non-fatal warnings.
- **SC-003**: In projection acceptance tests, 100% of targeted types match configured field allowlists and 100% of internal-strip runs remove all five specified internal fields.
- **SC-004**: In conformance acceptance tests, synchronized schema/type inputs pass type-checking, and intentional drift causes a detectable type-check failure for affected types.
- **SC-005**: In runtime validation acceptance tests, known cross-reference values pass, unknown values fail with clear messages, and missing context or empty optional values do not produce false failures.

## Assumptions

- The feature is implemented for the `langium-zod` package as a generator enhancement and CLI surface update.
- Existing generation behavior remains backward compatible unless a new option explicitly changes output.
- Warnings are visible to CLI users and do not terminate generation unless explicitly defined as errors.
- Type identity metadata remains present in generated schema outputs where currently expected.
- These five additions are independently shippable and may be delivered incrementally.
