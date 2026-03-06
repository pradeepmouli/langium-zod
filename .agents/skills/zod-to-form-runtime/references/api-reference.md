# @zod-to-form/react API Reference

## Components

### `ZodForm`

Main component that renders a complete form from a Zod v4 object schema.

```tsx
import { ZodForm } from '@zod-to-form/react';
```

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `schema` | `z.ZodObject<...>` | Yes | Top-level Zod object schema |
| `onSubmit` | `(data: z.infer<typeof schema>) => void` | No | Called with parsed data on valid submit |
| `onValueChange` | `(data: z.infer<typeof schema>) => void` | No | Called with parsed data on valid field changes |
| `mode` | `'onSubmit' \| 'onChange' \| 'onBlur'` | No | React Hook Form validation mode (default: `'onSubmit'`) |
| `defaultValues` | `Partial<z.infer<typeof schema>>` | No | Initial form values |
| `components` | `Partial<ComponentMap>` | No | Override the default component map |
| `componentConfig` | `RuntimeComponentConfig` | No | Runtime component mapping with field overrides |
| `formRegistry` | `ZodFormRegistry` | No | Zod v4 registry with `FormMeta` entries |
| `processors` | `Record<string, FormProcessor>` | No | Custom/override processors for schema walking |
| `className` | `string` | No | CSS class applied to the `<form>` element |
| `children` | `ReactNode` | No | Rendered inside the `<form>` (typically submit buttons) |

### `defaultComponentMap`

Built-in component map used by `ZodForm` when no `components` prop is provided.

```tsx
import { defaultComponentMap } from '@zod-to-form/react';
```

### `shadcnComponentMap`

shadcn/ui-oriented component map.

```tsx
import { shadcnComponentMap } from '@zod-to-form/react/shadcn';
```

## Hooks

### `useZodForm(schema, options?)`

Returns the React Hook Form instance and walked `FormField[]` descriptors.

```tsx
import { useZodForm } from '@zod-to-form/react';

const { form, fields } = useZodForm(userSchema, {
  mode: 'onChange',
  defaultValues: { name: 'Alice' },
  onValueChange: (values) => console.log(values),
  formRegistry,
  processors,
});
```

**Returns:**

| Property | Type | Description |
|---|---|---|
| `form` | `UseFormReturn<z.infer<typeof schema>>` | Full React Hook Form instance |
| `fields` | `FormField[]` | Walked field descriptors from the schema |

## Types

### `RuntimeComponentConfig`

```typescript
type RuntimeComponentConfig = {
  components: string;
  fieldTypes: Record<string, RuntimeComponentEntry>;
  fields?: Partial<Record<string, RuntimeFieldOverride>>;
};

type RuntimeComponentEntry = {
  component: string;
  render?: () => Promise<unknown>;
};

type RuntimeFieldOverride = {
  fieldType: string;
  props?: Record<string, unknown>;
};
```

### `FormMeta` (from `@zod-to-form/core`)

Metadata shape for `z.registry<FormMeta>()`:

```typescript
type FormMeta = {
  fieldType?: string;
  order?: number;
  hidden?: boolean;
  gridColumn?: string;
  props?: Record<string, unknown>;
};
```

## Supported Component Types

The walker infers these component names from Zod types:

| Zod Type | Component | Notes |
|---|---|---|
| `z.string()` | `Input` | `type` set by format (email, url, etc.) |
| `z.string()` (long) | `Textarea` | When `maxLength > 100` or metadata |
| `z.number()` | `Input` | `type="number"` |
| `z.boolean()` | `Checkbox` | Also `Switch` via metadata |
| `z.date()` | `DatePicker` | `type="date"` |
| `z.file()` | `FileInput` | `type="file"` |
| `z.enum()` | `Select` or `RadioGroup` | RadioGroup when <= 5 options |
| `z.object()` | `Fieldset` | Renders children recursively |
| `z.array()` | `ArrayField` | Repeater with add/remove |
| `z.discriminatedUnion()` | `Select` | Reveals variant fields on selection |
