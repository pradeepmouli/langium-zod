# Shared Component Configuration

Both the runtime `<ZodForm>` and the CLI `zodform generate` accept an identical component config shape. Define the config once and use it in both paths to produce functionally identical forms.

## Config Shape

```typescript
type ComponentConfig = {
  // Module specifier — npm package, relative path, or alias
  components: string;

  // Map field component types to named exports from that module
  fieldTypes: Record<
    string,
    {
      component: string;
      render?: () => Promise<unknown>; // runtime only
    }
  >;

  // Per-field overrides (highest priority)
  fields?: Record<
    string,
    {
      fieldType: string; // must exist in fieldTypes
      props?: Record<string, unknown>; // pass-through props
    }
  >;
};
```

## Defining the Config

```typescript
// src/config/form-components.ts
import { defineComponentConfig } from '@zod-to-form/cli';

export default defineComponentConfig({
  components: '@/components/ui',
  fieldTypes: {
    Input: { component: 'TextInput' },
    Textarea: { component: 'TextareaInput' },
    Select: { component: 'SelectInput' },
    Checkbox: { component: 'CheckboxInput' },
    DatePicker: { component: 'DateInput' },
    'cross-ref': { component: 'TypeSelector' }
  },
  fields: {
    bio: { fieldType: 'Textarea', props: { rows: 6 } },
    'address.country': { fieldType: 'cross-ref', props: { refType: 'Country' } }
  }
});
```

## Using with the CLI

```bash
npx zodform generate \
  --schema src/schemas/user.ts \
  --export userSchema \
  --component-config src/config/form-components.ts \
  --out src/components/
```

The CLI resolves the config at build time and emits static imports and JSX:

```tsx
import { TextInput, TextareaInput, TypeSelector } from '@/components/ui';

// Per-field override applied statically:
<TextareaInput id="bio" {...register('bio')} rows={6} />
<TypeSelector id="address.country" {...register('address.country')} refType="Country" />
```

## Using with the Runtime

```tsx
import { ZodForm } from '@zod-to-form/react';
import componentConfig from '@/config/form-components';

<ZodForm schema={userSchema} componentConfig={componentConfig} onSubmit={handleSubmit}>
  <button type="submit">Save</button>
</ZodForm>;
```

The runtime resolves the config at render time and dynamically loads components from the module path.

## Resolution Priority

Both paths use the same 3-level lookup order:

1. **Per-field override** — `config.fields['bio']` checked first. If found, its `fieldType` resolves through `fieldTypes`, and its `props` are merged into the rendered component.
2. **Field type mapping** — `config.fieldTypes['Textarea']` checked next. Maps the walker's inferred component type to a named export.
3. **Default rendering** — Falls back to built-in `<input>`, `<select>`, `<textarea>`, etc.

## Type-Safe Config

`defineComponentConfig<TComponents, TValues>()` provides compile-time autocomplete for component names and field paths:

```typescript
import { defineComponentConfig } from '@zod-to-form/cli';
import type { z } from 'zod';

type Values = z.infer<typeof userSchema>;
type Components = {
  TextInput: unknown;
  TextareaInput: unknown;
  SelectInput: unknown;
  TypeSelector: unknown;
};

export default defineComponentConfig<Components, Values>({
  components: '@/components/ui',
  fieldTypes: {
    Input: { component: 'TextInput' }, // autocompletes component names
    Textarea: { component: 'TextareaInput' }
  },
  fields: {
    bio: { fieldType: 'Textarea', props: { rows: 6 } }, // autocompletes field paths
    'address.country': { fieldType: 'cross-ref' }
  }
});
```

## Extending a Base Preset (e.g. shadcn/ui)

Define a config that overrides only the field types that need custom components. Combine with a base preset so unmatched fields fall through to defaults.

```typescript
// src/config/form-components.ts
import { defineComponentConfig } from '@zod-to-form/cli';

export default defineComponentConfig({
  components: '@/components/ui',
  fieldTypes: {
    DatePicker: { component: 'MyDatePicker' },
    Textarea: { component: 'MyRichTextEditor' }
    // Other field types (Input, Select, Checkbox, etc.) are not listed —
    // they fall through to the base preset (shadcn or unstyled)
  },
  fields: {
    bio: { fieldType: 'Textarea', props: { rows: 6 } }
  }
});
```

### Runtime — shadcn base + config overrides

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
</ZodForm>;
```

### CLI — `--ui shadcn` base + `--component-config` overrides

```bash
npx zodform generate \
  --schema src/schemas/user.ts \
  --export userSchema \
  --ui shadcn \
  --component-config src/config/form-components.ts \
  --out src/components/
```

In both paths, `componentConfig` field/type overrides take precedence. Unmatched fields resolve through the base component map (shadcn), then fall back to built-in HTML elements.

## When to Use Shared Config

- Use the same config for both paths when prototyping with runtime and deploying with codegen.
- Start with `<ZodForm>` + `componentConfig` during development for instant feedback.
- Switch to `zodform generate --component-config` for production to eliminate the runtime dependency.
- The generated output uses the exact same components and props — so the forms are functionally identical.
