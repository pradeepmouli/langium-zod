---
name: zod-to-form-cli
description: "This skill should be used when the user asks to generate a form from a Zod schema, use zodform CLI, codegen form component, generate tsx from zod, set up zod-to-form codegen, create a static form from schema, build-time form generation, zodform generate command, CLI form generator, zodform watch mode, zodform server action, or wants to generate static .tsx form components from Zod v4 schemas using the zodform generate CLI. Covers the generate command, component configuration, auto-save mode, server actions, watch mode, and the programmatic API."
---

# zod-to-form CLI Codegen Setup

Set up build-time form generation using `@zod-to-form/cli`. This skill covers installation, the `zodform generate` command, generated output structure, component configuration, auto-save mode, server actions, watch mode, and the programmatic API.

## When to Use

Apply this skill when a project needs static, hand-readable `.tsx` form components generated from Zod v4 schemas at build time. Best suited for production forms, design system integration, and cases where the generated code should be inspected, customized, and committed — with zero runtime dependency on zod-to-form.

## Prerequisites

- Node.js >= 20
- Zod v4 (`zod@^4.0.0`) — Zod v3 is **not** supported
- A Zod schema file with a named export

## Installation

```bash
pnpm add -D @zod-to-form/cli zod
```

The CLI is a dev dependency — it runs at build time, not in production.

## Basic Usage

### 1. Define a Schema File

```typescript
// src/schemas/user.ts
import { z } from 'zod';

export const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'editor', 'viewer']),
  bio: z.string().optional(),
  newsletter: z.boolean().default(false)
});
```

### 2. Generate the Form Component

```bash
npx zodform generate \
  --schema src/schemas/user.ts \
  --export userSchema \
  --out src/components/ \
  --name UserForm
```

### 3. Generated Output

The generated `src/components/UserForm.tsx` imports only `react-hook-form`, `@hookform/resolvers`, and the schema — no `@zod-to-form/*` imports appear:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { userSchema } from '../schemas/user';

type FormData = z.output<typeof userSchema>;

export function UserForm(props: { onSubmit: (data: FormData) => void }) {
  const { register, handleSubmit } = useForm<FormData>({
    resolver: zodResolver(userSchema)
  });

  return (
    <form onSubmit={handleSubmit(props.onSubmit)}>
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" type="text" {...register('name')} />
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" {...register('email')} />
      </div>
      <div>
        <label htmlFor="role">Role</label>
        <select id="role" {...register('role')}>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>
      <button type="submit">Submit</button>
    </form>
  );
}
```

## CLI Options

Required flags: `--schema <path>` and `--export <name>`. Common optional flags include `--out`, `--name`, `--mode` (`submit` | `auto-save`), `--ui` (`shadcn` | `unstyled`), `--component-config`, `--force`, `--dry-run`, `--server-action`, and `--watch`. See `references/cli-reference.md` for the complete flags table and naming conventions.

## Generation Modes

### Submit Mode (default)

Generates `handleSubmit` + `onSubmit` prop pattern:

```bash
npx zodform generate --schema src/schemas/user.ts --export userSchema
```

### Auto-Save Mode

Generates `watch` + `useEffect` pattern with `onValueChange` callback and no submit button:

```bash
npx zodform generate --schema src/schemas/user.ts --export userSchema --mode auto-save
```

Output uses `mode: 'onChange'` in `useForm` and fires `onValueChange` on every field update.

## Component Configuration

Map field types to custom components using a config file. This same format works with the runtime `<ZodForm>` — see `references/shared-config.md`.

### Define a Config File

```typescript
// src/config/form-components.ts
import { defineComponentConfig } from '@zod-to-form/cli';

export default defineComponentConfig({
  components: '@/components/ui',
  fieldTypes: {
    Input: { component: 'TextInput' },
    Textarea: { component: 'TextareaInput' },
    Select: { component: 'SelectInput' },
    Checkbox: { component: 'CheckboxInput' }
  },
  fields: {
    bio: { fieldType: 'Textarea', props: { rows: 6 } }
  }
});
```

### Generate with Config

```bash
npx zodform generate \
  --schema src/schemas/user.ts \
  --export userSchema \
  --component-config src/config/form-components.ts \
  --out src/components/
```

The generated file will include static imports from the config's `components` path and apply per-field props:

```tsx
import { TextInput, TextareaInput } from '@/components/ui';
// ...
<TextareaInput id="bio" {...register('bio')} rows={6} />;
```

Resolution priority: per-field override → field type mapping → default rendering. Use `defineComponentConfig<TComponents, TValues>()` for type-safe autocomplete. See `references/shared-config.md` for the full config shape, type-safe patterns, and resolution details.

## Server Actions

Generate a paired Next.js server action alongside the form:

```bash
npx zodform generate \
  --schema src/schemas/user.ts \
  --export userSchema \
  --server-action \
  --out src/components/
```

Produces both `UserForm.tsx` and `user-form-action.ts`.

## Watch Mode

Regenerate automatically when the schema file changes:

```bash
npx zodform generate \
  --schema src/schemas/user.ts \
  --export userSchema \
  --out src/components/ \
  --watch
```

Combine with `--force` to overwrite on each regeneration.

## Programmatic API

Embed generation in scripts or build pipelines using `runGenerate(options)` (returns `{ outputPath, code, wroteFile, actionPath, actionCode }`) or `createProgram()` for a Commander.js instance. See `references/cli-reference.md` for the full programmatic API, return types, and `validateComponentConfig()`.

## CI Integration

Add to a build script in `package.json`:

```json
{
  "scripts": {
    "generate:forms": "zodform generate --schema src/schemas/user.ts --export userSchema --out src/components/ --force"
  }
}
```

Or add as a pre-build step in CI pipelines to ensure generated forms stay in sync with schema changes.

## Relationship to Runtime Rendering

The CLI codegen and runtime `<ZodForm>` share `@zod-to-form/core` — the same walker produces the same `FormField[]` tree. A component config file can drive both paths to produce functionally identical forms. See `references/shared-config.md` for details.

## References

- **`references/shared-config.md`** — Shared component config format for CLI + runtime parity
- **`references/cli-reference.md`** — Complete CLI flags and programmatic API
