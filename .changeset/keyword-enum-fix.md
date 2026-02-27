---
"langium-zod": patch
---

Emit `z.union([z.literal(...)])` for Langium keyword enum rules (e.g. `CardinalityModifier returns string: 'any' | 'all'`) instead of falling back to `z.string()`.
