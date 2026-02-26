# Quickstart: Langium Zod Generator Plugin

**Date**: 2026-02-20
**Feature**: 001-langium-zod-plugin

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.0.0
- An existing Langium 4.x project with a `.langium` grammar file

## Installation

```bash
# From the monorepo root
pnpm install

# Build all packages
pnpm run build
```

## Usage

### Option 1: Programmatic (Standalone)

```typescript
import { generateZodSchemas } from 'langium-zod';
import { createMyLanguageServices } from './my-language-module';

const services = createMyLanguageServices();
const grammar = services.Grammar;

const zodSource = generateZodSchemas({
  grammar,
  services,
  // Optional: filter specific types
  // include: ['Expression', 'Statement'],
  // exclude: ['InternalNode'],
});

// Write to file
import { writeFileSync } from 'fs';
writeFileSync('src/generated/zod-schemas.ts', zodSource);
```

### Option 2: Langium DI Integration

Register the generator in your language's DI module:

```typescript
import { ZodSchemaGeneratorModule } from 'langium-zod';
import { createDefaultSharedModule, inject, Module } from 'langium';

// Add to your shared module
const shared = inject(
  createDefaultSharedModule(),
  ZodSchemaGeneratorModule,
);
```

Then invoke during generation:

```typescript
const generator = shared.ZodSchemaGenerator;
const zodSource = generator.generate(grammar);
```

### Option 3: CLI Extension *(future enhancement — not in current scope)*

> **Note**: CLI integration is a potential future enhancement. For now, use Option 1 (programmatic) or Option 2 (DI integration).

```bash
# Future: Generate all artifacts including Zod schemas
npx langium generate --zod

# Future: Or run standalone
npx langium-zod generate src/language/my-grammar.langium
```

## Generated Output

After running the generator, you'll find:

```
src/generated/
├── ast.ts            # Langium's generated AST types (existing)
├── grammar.ts        # Langium's generated grammar (existing)
├── module.ts         # Langium's generated module (existing)
└── zod-schemas.ts    # NEW: Generated Zod validation schemas
```

## Using Generated Schemas

```typescript
import { ExpressionSchema, AdditionSchema } from './generated/zod-schemas';

// Validate an AST node
const result = ExpressionSchema.safeParse(astNode);
if (result.success) {
  console.log('Valid:', result.data);
} else {
  console.error('Invalid:', result.error.issues);
}

// Direct parsing (throws on invalid)
const validated = AdditionSchema.parse(astNode);
```

## Configuration

### Include/Exclude Types

```typescript
generateZodSchemas({
  grammar,
  include: ['Expression', 'Statement', 'Declaration'],
  // OR
  exclude: ['InternalHelper', 'Fragment_Common'],
});
```

### Custom Output Path

```typescript
generateZodSchemas({
  grammar,
  outputPath: 'src/validation/schemas.ts',
});
```

## Development

```bash
# Run tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Lint
pnpm run lint

# Type check
pnpm run type-check
```
