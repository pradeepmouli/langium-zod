---
"langium-zod": patch
---

namespace-ops: config-declared identity `removeX` op. `generateNamespaceOps`
accepts `{ identity: Record<elementType, fieldPath> }`; array fields whose
element type has an identity path get `removeX(node, item): boolean` matching
by that path (single-segment direct, nested segments optional-chained). New CLI
flag `--domain-surface-config <path>` loads the `{ identity: {...} }` map.
