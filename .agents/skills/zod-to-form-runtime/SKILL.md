---
name: zod-to-form-runtime
description: 'This skill should be used when the user asks to "set up zod-to-form", "create a form from a Zod schema", "add ZodForm to my project", "render a form from schema", "schema to form", "auto-generate form fields", "use zod-to-form runtime", "install zod-to-form", "dynamic form generation", "useZodForm hook", "ZodForm component", "form builder from zod", or wants to generate React forms from Zod v4 schemas at runtime using the ZodForm component. Covers installation, ZodForm props, metadata annotations via z.registry(), component customization, and the useZodForm hook.'
---

# zod-to-form Runtime Setup

Set up schema-driven React form generation using `@zod-to-form/react`. This skill covers installation, basic and advanced usage of the `<ZodForm>` component, metadata annotations, component customization, and the `useZodForm` hook.

## When to Use

Apply this skill when a project needs to render React forms directly from Zod v4 schemas at runtime — no build step or code generation required. Best suited for rapid prototyping, admin panels, and CRUD forms where schemas change frequently and forms should update instantly.

## Prerequisites

- React 18+ project (React 19 supported)
- Zod v4 (`zod@^4.0.0`) — Zod v3 is **not** supported
- TypeScript (recommended, strict mode)

## Installation

```bash
pnpm add @zod-to-form/core @zod-to-form/react zod react react-hook-form @hookform/resolvers
```

Replace `pnpm add` with `npm install` or `yarn add` as appropriate for the project.

## Basic Setup

### 1. Define a Zod Schema

```typescript
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  role: z.enum(['admin', 'editor', 'viewer']),
  bio: z.string().optional(),
  newsletter: z.boolean().default(false),
});
```

### 2. Render with `<ZodForm>`

```tsx
import { ZodForm } from '@zod-to-form/react';

function UserForm() {
  return (
    <ZodForm
      schema={userSchema}
      onSubmit={(data) => console.log(data)} // typed as z.infer<typeof userSchema>
    >
      <button type="submit">Save</button>
    </ZodForm>
  );
}
```

`<ZodForm>` walks the schema, infers input types, derives labels from field names, wires `zodResolver` validation, and renders the form. No manual field mapping is needed.

## ZodForm Props

Key props: `schema` (required), `onSubmit`, `onValueChange`, `mode`, `defaultValues`, `components`, `componentConfig`, `formRegistry`, `processors`, `className`, `children`. See `references/api-reference.md` for the complete props table with types.

## Metadata Annotations

Control rendering with Zod v4's native `.meta()` and `z.registry()`:

```typescript
import { z } from 'zod';
import type { FormMeta } from '@zod-to-form/core';

const formRegistry = z.registry<FormMeta>();

const schema = z.object({
  name: z.string().meta({ title: 'Full Name' }),
  bio: z.string().optional(),
});

formRegistry.register(schema.shape.bio, {
  fieldType: 'textarea',
  order: 1,
  gridColumn: 'span 2',
});
```

```tsx
<ZodForm schema={schema} formRegistry={formRegistry} onSubmit={handleSubmit}>
  <button type="submit">Save</button>
</ZodForm>
```

## Custom Components

### Using shadcn/ui

```tsx
import { shadcnComponentMap } from '@zod-to-form/react/shadcn';

<ZodForm schema={schema} components={shadcnComponentMap} onSubmit={handleSubmit}>
  <button type="submit">Save</button>
</ZodForm>
```

### Extending shadcn with Custom Components

Use a shared component config to keep shadcn as the base while overriding specific field types. The same config file works with the CLI — see `references/shared-config.md`.

```typescript
// src/config/form-components.ts
import { defineComponentConfig } from '@zod-to-form/cli';

export default defineComponentConfig({
  components: '@/components/ui',
  fieldTypes: {
    DatePicker: { component: 'MyDatePicker' },
    Textarea: { component: 'MyRichTextEditor' },
  },
  fields: {
    bio: { fieldType: 'Textarea', props: { rows: 6 } },
  },
});
```

Pass shadcn as the base and the config for overrides:

```tsx
import { shadcnComponentMap } from '@zod-to-form/react/shadcn';
import componentConfig from '@/config/form-components';

<ZodForm
  schema={schema}
  components={shadcnComponentMap}
  componentConfig={componentConfig}
  onSubmit={handleSubmit}
>
  <button type="submit">Save</button>
</ZodForm>
```

Fields matched by the config get custom components; everything else renders with shadcn defaults.

### Using a Component Config

Pass a `componentConfig` prop to map field types to custom components. This same config format works with the CLI codegen path — define the config once and use it in both paths. See `references/shared-config.md` for the full config shape, type-safe patterns, and resolution priority.

```tsx
import componentConfig from '@/config/form-components';

<ZodForm schema={schema} componentConfig={componentConfig} onSubmit={handleSubmit}>
  <button type="submit">Save</button>
</ZodForm>
```

## useZodForm Hook

For full control over the React Hook Form instance:

```tsx
import { useZodForm } from '@zod-to-form/react';

function AdvancedForm() {
  const { form, fields } = useZodForm(schema, {
    mode: 'onChange',
    onValueChange: (values) => console.log(values),
  });

  // Full access to RHF: form.watch(), form.setValue(), form.formState, etc.
  return <pre>{JSON.stringify(fields, null, 2)}</pre>;
}
```

## Supported Zod Types

All major Zod types are supported — including nested objects (fieldset groups), arrays (repeaters with add/remove), and discriminated unions (select revealing variant fields). See `references/api-reference.md` for the full Zod-type-to-component mapping table.

## Relationship to CLI Codegen

The runtime renderer and CLI codegen share `@zod-to-form/core` — the same walker produces the same `FormField[]` tree. A component config file can drive both paths to produce functionally identical forms. See `references/shared-config.md` for details.

## References

- **`references/shared-config.md`** — Shared component config format for runtime + CLI parity
- **`references/api-reference.md`** — Complete API surface for `@zod-to-form/react`
