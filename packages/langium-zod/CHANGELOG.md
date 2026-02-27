# langium-zod

## 0.3.0

### Minor Changes

- 232c3e8: Improve AST schema generation and mapping behavior:

  - Add a generated master discriminated union export named `AstNodeSchema` keyed by `$type`
  - Improve extractor handling for primitive aliases and filtered fallback stubs
  - Improve cross-reference mapping in the type mapper and expand test coverage

## 0.2.0

### Minor Changes

- dd84bf3: Improve schema generation for Langium unions and datatype aliases, add safer reference handling in generated code, and upgrade `x-to-zod` to `^0.8.0`.
