# Research: Rune DSL schema generation enhancements

**Date**: 2026-02-27
**Feature**: 002-rune-dsl-enhancements

## Decision 1: Cardinality metadata propagation for `+=` assignments

**Decision**: Carry one-or-more cardinality as `minItems: 1` on array property descriptors when assignment operator is `+=` and the associated rule call cardinality is `+`.

**Rationale**: This is the minimal correction that preserves current mapping flow and fixes silent loss of required array semantics.

**Alternatives considered**:
- Infer `minItems` during final code generation by re-reading grammar AST — rejected due to leaking grammar concerns into generator stage.
- Treat all `+=` arrays as min(1) — rejected because it breaks `*` and no-cardinality cases.

## Decision 2: CLI filter semantics and precedence

**Decision**: Support `--include`/`--exclude` as comma-separated CLI options; CLI values override config file values. When both filters contain the same type, apply include first, then exclude (exclude wins).

**Rationale**: Matches user clarification and yields deterministic output with conservative conflict resolution.

**Alternatives considered**:
- Include wins on overlap — rejected (higher risk of accidental generation).
- Fail on overlap — rejected (unnecessary friction for users).

## Decision 3: Projection behavior and failure mode

**Decision**: Add projection support with optional global `--strip-internals`. Unknown projection fields warn and skip. Invalid/unreadable projection files fail fast with no output changes.

**Rationale**: Preserves safety for explicit projection intent while keeping non-fatal behavior for field-level drift.

**Alternatives considered**:
- Continue generation without projection on parse/read errors — rejected because it can silently produce wrong schema surfaces.
- Fail on unknown projection fields — rejected; field-level warning is sufficient and more ergonomic.

## Decision 4: Conformance AST path resolution

**Decision**: `--conformance` can use explicit `--ast-types`; if omitted, resolve AST path from `langium-config.json`. If unresolved from both sources, fail fast.

**Rationale**: Matches clarified requirement and reduces CLI friction for standard Langium projects.

**Alternatives considered**:
- Require `--ast-types` always — rejected by clarification.
- Allow package specifier imports for AST types — rejected for now to keep deterministic file-path based generation.

## Decision 5: Cross-reference runtime validation model

**Decision**: Keep static schemas unchanged by default. Under `--cross-ref-validation`, emit `create*Schema(refs)` factories and `*SchemaRefs` contracts only for types with retained cross-reference fields; always export `zRef()` utility.

**Rationale**: Adds runtime safety without breaking existing consumers; supports injection of live reference collections.

**Alternatives considered**:
- Always emit factories — rejected to avoid noisy API growth when not needed.
- Embed live reference data in generated schemas — rejected because reference collections are runtime-dependent.

## Decision 6: Ordering of generation pipeline transforms

**Decision**: Apply type filtering first, then projection/stripping, then conformance/factory emission based on resulting schema surfaces.

**Rationale**: Ensures downstream outputs (conformance checks and factory refinements) reflect actual emitted schemas.

**Alternatives considered**:
- Projection before include/exclude — rejected due to wasted work and less intuitive behavior.
- Conformance against unprojected shape — rejected because it conflicts with requirement to respect active surface.
