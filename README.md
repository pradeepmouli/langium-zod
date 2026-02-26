# langium-zod

Monorepo for `@pradeepmouli/langium-zod`, a Langium generator plugin that derives Zod validation schemas from grammar definitions.

## Package

- npm: `@pradeepmouli/langium-zod`
- source: `packages/langium-zod`

## Quick Start

```bash
pnpm install
pnpm run build
pnpm run test
```

## Use in a project

```ts
import { generateZodSchemas } from '@pradeepmouli/langium-zod';

const zodSource = generateZodSchemas({ grammar, services });
```

## Release / Publish

- Create a changeset: `pnpm changeset`
- Version packages: `pnpm changeset:version`
- Publish package(s): `pnpm changeset:publish`

Automated release is configured in GitHub Actions at `.github/workflows/release.yml`.

## Development Commands

```bash
pnpm run lint
pnpm run format:check
pnpm run type-check
pnpm run build
pnpm run test
```

## Documentation

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/EXAMPLES.md](docs/EXAMPLES.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
