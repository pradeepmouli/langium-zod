---
"langium-zod": patch
---

namespace-ops: `moveXAt` now guards an out-of-range `from` index. Previously
`splice(from, 1)` with a negative `from` removed an element from the END of the
array (corrupting order) instead of being a no-op. Adds
`if (from < 0 || from >= node.<field>.length) return;`, matching the typical
consumer reorder contract (out-of-range from → no-op).
