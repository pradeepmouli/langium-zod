import type { ZodPropertyDescriptor, ZodTypeDescriptor, ZodTypeExpression } from './types.js';

function collectReferenceTypeNames(expression: ZodTypeExpression): string[] {
  switch (expression.kind) {
    case 'reference':
      return [expression.typeName];
    case 'array':
      return collectReferenceTypeNames(expression.element);
    case 'union':
      return expression.members.flatMap((member) => collectReferenceTypeNames(member));
    case 'lazy':
      return collectReferenceTypeNames(expression.inner);
    default:
      return [];
  }
}

function propertyReferences(property: ZodPropertyDescriptor): string[] {
  return collectReferenceTypeNames(property.zodType);
}

/**
 * Detects type names that participate in a reference cycle across the descriptor
 * graph.
 *
 * Builds a directed graph where each object type descriptor is a node and each
 * type reference in its properties is an edge. A depth-first search then
 * identifies all nodes that belong to at least one cycle. The generator uses this
 * set to emit getter-based property accessors instead of direct value expressions,
 * avoiding JavaScript "used before declaration" errors for mutually-recursive Zod
 * schemas.
 *
 * Only `'object'` kind descriptors are considered; union and primitive-alias
 * descriptors are transparent to cycle detection.
 *
 * @remarks
 * A Langium grammar with a rule like `Expression: value=Expression | ...` is
 * self-referential at the object level. Without getter syntax, the emitted
 * `const ExpressionSchema = z.object({ value: ExpressionSchema })` would fail at
 * runtime because `ExpressionSchema` is referenced before it is defined. The
 * returned set marks `Expression` as recursive so the generator can emit
 * `get value() { return ExpressionSchema; }` instead.
 *
 * Mutual cycles (A → B → A) are also detected: both A and B will appear in the
 * returned set. Diamond-shaped references (A → C and B → C, but no back-edge)
 * are not cycles and will not appear in the result.
 *
 * @param descriptors - The full list of type descriptors to analyse, as returned
 *   by {@link extractTypeDescriptors}.
 * @returns A `Set` of type names that are involved in at least one reference cycle.
 *
 * @example
 * ```ts
 * import { extractTypeDescriptors, detectRecursiveTypes } from 'langium-zod';
 * import { collectAst } from 'langium/grammar';
 *
 * const descriptors = extractTypeDescriptors(collectAst(myGrammar));
 * const recursive = detectRecursiveTypes(descriptors);
 * console.log([...recursive]); // e.g. ['Expression', 'Statement']
 * ```
 *
 * @useWhen
 * - You need to know which grammar types are recursive before calling
 *   {@link generateZodCode} (e.g. to log or filter them).
 * - You are building a custom code emitter and need the same cycle information that
 *   the built-in generator uses.
 *
 * @avoidWhen
 * - You are using the standard pipeline — {@link generateZodSchemas} and
 *   {@link generateZodCode} call this function internally; you do not need to
 *   call it yourself.
 *
 * @pitfalls
 * - NEVER pass descriptors that have already had projection applied (via
 *   `applyProjectionToDescriptors`) to this function if the projection strips
 *   properties that close cycles. BECAUSE the cycle detection graph will miss the
 *   back-edge and fail to mark those types as recursive, leading to `undefined`
 *   reference errors in the generated schemas at runtime.
 * - NEVER assume the returned set is stable across different filter configurations.
 *   BECAUSE filtering with `include`/`exclude` can remove types that close a cycle,
 *   making previously recursive types appear acyclic.
 *
 * @category Analysis
 * @see {@link extractTypeDescriptors}
 * @see {@link generateZodCode}
 * @see {@link ZodTypeDescriptor}
 */
export function detectRecursiveTypes(descriptors: ZodTypeDescriptor[]): Set<string> {
  const edges = new Map<string, Set<string>>();

  for (const descriptor of descriptors) {
    if (descriptor.kind !== 'object') {
      continue;
    }

    const refs = new Set<string>();
    for (const property of descriptor.properties) {
      for (const typeName of propertyReferences(property)) {
        refs.add(typeName);
      }
    }
    edges.set(descriptor.name, refs);
  }

  const recursive = new Set<string>();
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const dfs = (node: string, path: string[]): void => {
    if (visiting.has(node)) {
      const cycleStart = path.indexOf(node);
      const cycle = cycleStart >= 0 ? path.slice(cycleStart) : [node];
      for (const item of cycle) {
        recursive.add(item);
      }
      return;
    }

    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    visiting.add(node);
    for (const next of edges.get(node) ?? []) {
      if (!edges.has(next)) {
        continue;
      }
      dfs(next, [...path, node]);
    }
    visiting.delete(node);
  };

  for (const node of edges.keys()) {
    dfs(node, []);
  }

  return recursive;
}
