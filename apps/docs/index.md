---
layout: home
hero:
  name: langium-zod
  text: Zod schemas from Langium grammars
  tagline: Derive Zod v4 validation schemas from Langium grammar definitions, enabling runtime validation of AST-shaped data.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/pradeepmouli/langium-zod
features:
  - title: Grammar-driven schemas
    details: Walks Langium's inferred AstTypes (interfaces, unions, primitives, cross-references) and emits a corresponding set of Zod schemas as a single TypeScript module.
  - title: Recursive type support
    details: Detects cycles in the type graph and emits z.lazy(...) where required so recursive AST shapes validate correctly.
  - title: Cross-reference helper
    details: Provides a zRef runtime helper so generated schemas can model Langium cross-references without losing type safety.
  - title: Langium DI integration
    details: DefaultZodSchemaGenerator and ZodSchemaGeneratorModule let you register generation as a service on a custom language.
  - title: Configurable output
    details: Control output paths and filter which types are emitted via FilterConfig and ZodGeneratorConfig.
  - title: Structured errors
    details: Generation failures surface as ZodGeneratorError with enough context to pinpoint the grammar element at fault.
---
