# @zod-to-form/cli Reference

## Command: `zodform generate`

```
zodform generate [options]
```

### Required Options

| Flag              | Description                                                        |
| ----------------- | ------------------------------------------------------------------ |
| `--schema <path>` | Path to the TypeScript/JavaScript module containing the Zod schema |
| `--export <name>` | Named export that contains the `z.object(...)` schema              |

### Optional Flags

| Flag                        | Default                 | Description                                                                                              |
| --------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `--out <path>`              | `./<Name>Form.tsx`      | Output directory or `.tsx` file path                                                                     |
| `--name <name>`             | Derived from `--export` | Component name (e.g., `UserForm`). If omitted, derived by stripping `Schema` suffix and appending `Form` |
| `--mode <mode>`             | `submit`                | `submit` — standard `handleSubmit` pattern; `auto-save` — `watch` + `useEffect` pattern                  |
| `--ui <preset>`             | `shadcn`                | `shadcn` or `unstyled`                                                                                   |
| `--component-config <path>` | —                       | Path to component config file (`.json` or `.ts`)                                                         |
| `--force`                   | `false`                 | Overwrite existing output file                                                                           |
| `--dry-run`                 | `false`                 | Print generated code to stdout without writing files                                                     |
| `--server-action`           | `false`                 | Generate a Next.js server action alongside the form                                                      |
| `--watch`                   | `false`                 | Watch the schema file and regenerate on changes                                                          |

## Naming Conventions

| `--export` value | Derived `--name` | Output file         |
| ---------------- | ---------------- | ------------------- |
| `userSchema`     | `UserForm`       | `UserForm.tsx`      |
| `orderSchema`    | `OrderForm`      | `OrderForm.tsx`     |
| `loginData`      | `LoginDataForm`  | `LoginDataForm.tsx` |

Override with `--name`:

```bash
zodform generate --schema src/user.ts --export userSchema --name ProfileEditor
# → ProfileEditor.tsx
```

## Generated Output Structure

### Submit Mode

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { userSchema } from './schema';

type FormData = z.output<typeof userSchema>;

export function UserForm(props: { onSubmit: (data: FormData) => void }) {
  const { register, handleSubmit } = useForm<FormData>({
    resolver: zodResolver(userSchema)
  });

  return (
    <form onSubmit={handleSubmit(props.onSubmit)}>
      {/* fields */}
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Auto-Save Mode

```tsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { userSchema } from './schema';

type FormData = z.output<typeof userSchema>;

export function UserForm(props: {
  onValueChange?: (data: FormData) => void;
  onSubmit?: (data: FormData) => void;
}) {
  const { register, watch } = useForm<FormData>({
    resolver: zodResolver(userSchema),
    mode: 'onChange'
  });

  useEffect(() => {
    const subscription = watch((values) => {
      props.onValueChange?.(values as FormData);
    });
    return () => subscription.unsubscribe();
  }, [watch, props.onValueChange]);

  return <form>{/* fields — no submit button */}</form>;
}
```

### With Arrays

When the schema contains `z.array()`, the output includes `useFieldArray`:

```tsx
import { useForm, useFieldArray } from 'react-hook-form';
// ...
const { register, handleSubmit, control } = useForm<FormData>({ ... });
const { fields: itemsFields, append: appendItems, remove: removeItems } = useFieldArray({
  control, name: 'items'
});
```

## Programmatic API

### `runGenerate(options)`

```typescript
import { runGenerate } from '@zod-to-form/cli';

const result = await runGenerate({
  schema: './src/schemas/user.ts',
  export: 'userSchema',
  out: './src/components/',
  name: 'UserForm',
  mode: 'submit',
  ui: 'shadcn',
  force: true,
  serverAction: true
});
```

**Returns:**

| Property     | Type                  | Description                                                                    |
| ------------ | --------------------- | ------------------------------------------------------------------------------ |
| `outputPath` | `string`              | Absolute path to the generated `.tsx` file                                     |
| `code`       | `string`              | Generated TypeScript source                                                    |
| `wroteFile`  | `boolean`             | Whether the file was written (false in dry-run or if exists without `--force`) |
| `actionPath` | `string \| undefined` | Path to server action file (when `serverAction: true`)                         |
| `actionCode` | `string \| undefined` | Server action source                                                           |

### `createProgram()`

Returns a Commander.js `Command` instance for embedding in custom CLIs:

```typescript
import { createProgram } from '@zod-to-form/cli';

const program = createProgram();
await program.parseAsync(['node', 'zodform', 'generate', '--schema', ...]);
```

### `defineComponentConfig(config)`

Type-safe helper for component config files:

```typescript
import { defineComponentConfig } from '@zod-to-form/cli';

export default defineComponentConfig<Components, Values>({
  components: '@/components/ui',
  fieldTypes: { ... },
  fields: { ... },
});
```

### `validateComponentConfig(value, source?)`

Runtime validation for externally loaded config objects:

```typescript
import { validateComponentConfig } from '@zod-to-form/cli';

const parsed = validateComponentConfig(loadedConfig, 'my-config.json');
```

Throws with descriptive error messages if the config shape is invalid.
