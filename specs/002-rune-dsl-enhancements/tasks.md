# Tasks: Rune DSL schema generation enhancements

**Input**: Design documents from `/specs/002-rune-dsl-enhancements/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare fixtures and test scaffolding used across user stories.

- [x] T001 Create projection fixture files in packages/langium-zod/test/fixtures/projection.valid.json and packages/langium-zod/test/fixtures/projection.invalid.json
- [x] T002 Create conformance fixture langium config in packages/langium-zod/test/fixtures/langium-config.json
- [x] T003 [P] Add shared test helper for temporary output paths in packages/langium-zod/test/integration/test-output-utils.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Introduce shared API/types and generation pipeline hooks required by all stories.

- [x] T004 Extend generator-facing option types in packages/langium-zod/src/types.ts
- [x] T005 Extend public API config contract in packages/langium-zod/src/api.ts
- [x] T006 Add shared generation pipeline wiring contract (without story-specific behavior) in packages/langium-zod/src/generator.ts

**Checkpoint**: Foundation complete; user stories can now be implemented and validated independently.

---

## Phase 3: User Story 1 - Enforce one-or-more cardinality (Priority: P1) 🎯 MVP

**Goal**: Preserve `+` cardinality as array minimum length in generated schemas.

**Independent Test**: Generate from fixture grammar with `+=Rule+`, `+=Rule*`, and `+=Rule`; verify only `+` emits `.min(1)`.

### Tests for User Story 1

- [x] T007 [P] [US1] Add failing extractor/type-mapper test for `+=` cardinality handling in packages/langium-zod/test/unit/type-mapper.test.ts
- [x] T008 [P] [US1] Add failing generation assertion for `.min(1)` output behavior in packages/langium-zod/test/integration/generation.test.ts

### Implementation for User Story 1

- [x] T009 [US1] Add `minItems` support on property descriptors in packages/langium-zod/src/types.ts
- [x] T010 [US1] Capture `ruleCall.cardinality === '+'` as `minItems: 1` in packages/langium-zod/src/extractor.ts
- [x] T011 [US1] Emit `.min(minItems)` for array schemas when present in packages/langium-zod/src/generator.ts

**Checkpoint**: US1 is independently complete and testable.

---

## Phase 4: User Story 2 - Filter generated types from CLI (Priority: P1)

**Goal**: Expose `--include` and `--exclude` in CLI with deterministic precedence and warnings.

**Independent Test**: Run CLI generation with include/exclude combos and unknown names; verify filtering and warnings.

### Tests for User Story 2

- [x] T012 [P] [US2] Add failing CLI tests for include/exclude parsing and filtering in packages/langium-zod/test/integration/langium-cli.external.test.ts
- [x] T013 [P] [US2] Add failing CLI test for overlap behavior (include first, exclude wins) in packages/langium-zod/test/integration/langium-cli.external.test.ts
- [x] T014 [P] [US2] Add failing CLI test for unknown type warning with available types listing in packages/langium-zod/test/integration/langium-cli.external.test.ts

### Implementation for User Story 2

- [x] T015 [US2] Add `--include` and `--exclude` command options with CSV parsing in packages/langium-zod/src/cli.ts
- [x] T016 [US2] Implement CLI-over-config precedence and overlap resolution in packages/langium-zod/src/cli.ts
- [x] T017 [US2] Add non-fatal unknown-type warning logic using available descriptor names in packages/langium-zod/src/cli.ts

**Checkpoint**: US2 is independently complete and testable.

---

## Phase 5: User Story 3 - Generate form-surface schemas (Priority: P1)

**Goal**: Support projection and internal stripping to generate form-oriented schema surfaces.

**Independent Test**: Run with `--strip-internals` and `--projection`; verify retained/removed fields and fatal behavior for invalid files.

### Tests for User Story 3

- [x] T018 [P] [US3] Add failing unit tests for projection parsing and field filtering in packages/langium-zod/test/unit/projection.test.ts
- [x] T019 [P] [US3] Add failing integration tests for strip-internals and projection output shaping in packages/langium-zod/test/integration/generation.test.ts
- [x] T020 [P] [US3] Add failing CLI test for invalid projection file fail-fast with no output changes in packages/langium-zod/test/integration/langium-cli.external.test.ts

### Implementation for User Story 3

- [x] T021 [US3] Implement projection config types and loader/filter helpers in packages/langium-zod/src/projection.ts
- [x] T022 [US3] Add `projection` option to public facade config in packages/langium-zod/src/api.ts
- [x] T023 [US3] Add `--projection` and `--strip-internals` options with file-loading behavior in packages/langium-zod/src/cli.ts
- [x] T024 [US3] Apply projection and internal stripping before object emission in packages/langium-zod/src/generator.ts

**Checkpoint**: US3 is independently complete and testable.

---

## Phase 6: User Story 4 - Verify schema/type conformance (Priority: P2)

**Goal**: Generate optional compile-time conformance artifacts aligned to active schema surfaces.

**Independent Test**: Enable conformance generation, verify file output and type-check behavior for in-sync and drift scenarios.

### Tests for User Story 4

- [x] T025 [P] [US4] Add failing tests for conformance file generation content and strip-aware omit set in packages/langium-zod/test/integration/generation.test.ts
- [x] T026 [P] [US4] Add failing CLI tests for ast path auto-resolution from langium-config and unresolved-path failure in packages/langium-zod/test/integration/langium-cli.external.test.ts
- [x] T027 [P] [US4] Add failing tests for missing AST exports warnings and zero-schema conformance skip behavior in packages/langium-zod/test/integration/generation.test.ts

### Implementation for User Story 4

- [x] T028 [US4] Implement conformance file generator in packages/langium-zod/src/conformance.ts
- [x] T029 [US4] Add conformance options to public facade config in packages/langium-zod/src/api.ts
- [x] T030 [US4] Implement `--conformance`/`--ast-types`/`--conformance-out` and langium-config resolution in packages/langium-zod/src/cli.ts
- [x] T031 [US4] Emit conformance artifacts and warnings from generation pipeline in packages/langium-zod/src/generator.ts

**Checkpoint**: US4 is independently complete and testable.

---

## Phase 7: User Story 5 - Validate cross-references at runtime (Priority: P2)

**Goal**: Add opt-in cross-reference runtime validators and schema factory generation.

**Independent Test**: Enable cross-ref validation and verify factory emission, runtime pass/fail behavior, permissive defaults, and projection composition.

### Tests for User Story 5

- [x] T032 [P] [US5] Add failing integration tests for factory/interface emission only when flag enabled in packages/langium-zod/test/integration/generation.test.ts
- [x] T033 [P] [US5] Add failing integration tests for runtime validation pass/fail and permissive no-ref defaults in packages/langium-zod/test/integration/generation.test.ts
- [x] T034 [P] [US5] Add failing test for projection-stripped cross-ref fields not being refined in packages/langium-zod/test/integration/generation.test.ts
- [x] T035 [P] [US5] Add failing package export test for `zRef` availability in packages/langium-zod/test/integration/di.test.ts

### Implementation for User Story 5

- [x] T036 [US5] Implement `zRef` utility in packages/langium-zod/src/ref-utils.ts
- [x] T037 [US5] Re-export `zRef` in packages/langium-zod/src/index.ts
- [x] T038 [US5] Add cross-reference validation option to facade API config in packages/langium-zod/src/api.ts
- [x] T039 [US5] Add `--cross-ref-validation` command option in packages/langium-zod/src/cli.ts
- [x] T040 [US5] Emit `*SchemaRefs` and `create*Schema(refs)` only for retained cross-ref fields in packages/langium-zod/src/generator.ts

**Checkpoint**: US5 is independently complete and testable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final documentation and full-suite verification across all stories.

- [x] T041 [P] Update package usage docs for new flags and utilities in packages/langium-zod/README.md
- [x] T042 [P] Add release-note entry for feature 002 enhancements in packages/langium-zod/CHANGELOG.md
- [x] T043 Add changeset for published package changes in .changeset/002-rune-dsl-enhancements.md
- [x] T044 Run full verification commands from quickstart in packages/langium-zod (pnpm run lint, pnpm test)
- [x] T045 Run required type-check gate (pnpm run type-check)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phases 3–7 (User Stories)**: Depend on Phase 2; can proceed independently after foundational completion.
- **Phase 8 (Polish)**: Depends on completion of desired user stories.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; no dependency on other user stories.
- **US2 (P1)**: Starts after Phase 2; no dependency on other user stories.
- **US3 (P1)**: Starts after Phase 2; no dependency on other user stories.
- **US4 (P2)**: Starts after Phase 2; independent of US1–US3, but must honor projection/strip behavior if combined.
- **US5 (P2)**: Starts after Phase 2; independent of US1–US4, but uses final retained field surface when combined.

### Within Each User Story

- Tests first and failing before implementation.
- API/descriptor changes before generator/CLI behavior using those shapes.
- Story checkpoint reached only after tests pass for that story.

## Parallel Execution Examples

### User Story 1

- Run in parallel: T007 and T008.
- Then implement in order: T009 → T010 → T011.

### User Story 2

- Run in parallel: T012, T013, and T014.
- Then implement in order: T015 → T016 → T017.

### User Story 3

- Run in parallel: T018, T019, and T020.
- Then implement in order: T021 and T022 can run in parallel, followed by T023 → T024.

### User Story 4

- Run in parallel: T025, T026, and T027.
- Then implement in order: T028 and T029 can run in parallel, followed by T030 → T031.

### User Story 5

- Run in parallel: T032, T033, T034, and T035.
- Then implement in order: T036 and T038 can run in parallel, followed by T037 and T039 in parallel, then T040.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate US1 independently as the first shippable increment.

### Incremental Delivery

1. Deliver US1 (correctness fix).
2. Deliver US2 (CLI filtering ergonomics).
3. Deliver US3 (projection/form-surface mode).
4. Deliver US4 (conformance safety net).
5. Deliver US5 (runtime cross-reference validation).
6. Finish Phase 8 polish and full regression verification.

### Parallel Team Strategy

- Team completes Setup + Foundational together.
- After Phase 2, separate owners can execute US1–US5 phases in parallel with regular rebases.
- Keep each story branch-scoped to its task subset to preserve independent testability.
