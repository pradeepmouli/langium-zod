import { GrammarAST, GrammarUtils } from 'langium';
import type { AstNode } from 'langium';
import type { PropertyLike } from './types.js';
import { isMandatoryOccurrence } from './array-min-occurrence.js';

/**
 * Walks up from a grammar Assignment/Action node to find the nearest enclosing
 * `Alternatives` element and the index of the branch (direct child of that
 * `Alternatives`) that contains it. Returns `undefined` when no `Alternatives`
 * ancestor exists before the owning `ParserRule`.
 */
// Real grammar container chains are shallow (bounded by nesting depth in the
// source file); this cap only guards against a malformed/cyclic `$container`
// chain (e.g. a bad duck-typed test fixture) turning into an infinite loop.
const MAX_CONTAINER_WALK = 1000;

function findEnclosingBranch(
  node: AstNode
): { alternatives: GrammarAST.Alternatives; branchIndex: number } | undefined {
  let child: AstNode = node;
  let el: AstNode | undefined = node;
  for (let steps = 0; el && steps < MAX_CONTAINER_WALK; steps++) {
    if (GrammarAST.isAlternatives(el)) {
      const branchIndex = el.elements.indexOf(child as GrammarAST.AbstractElement);
      if (branchIndex >= 0) {
        return { alternatives: el, branchIndex };
      }
    }
    if (GrammarAST.isParserRule(el)) {
      return undefined;
    }
    child = el;
    el = el.$container as AstNode | undefined;
  }
  return undefined;
}

/**
 * Determines whether a grammar `AbstractElement` subtree contains at least one
 * CHECKABLE `Assignment`/`Action` that is MANDATORY WITHIN THE BRANCH — i.e.
 * one guaranteed to occur whenever the branch is taken at all, whose presence
 * in the parsed value can therefore distinguish "this branch was taken" from
 * "nothing populated".
 *
 * Descends the subtree tracking cardinality along the way: any `?`/`*` on an
 * element ANYWHERE between the branch root and a candidate assignment means
 * that assignment is NOT guaranteed — the branch can be taken (e.g. via a
 * leading keyword) while the optional/starred sub-element matches zero times,
 * producing a parser-valid object where that assignment never fires. Such an
 * assignment does not count, exactly like a bare keyword-only branch.
 *
 * Boolean flag assignments (`?=`) are EXCLUDED regardless of cardinality:
 * Langium always serialises them as `false` when absent, so their presence
 * can never distinguish an empty body from a populated one.
 */
function branchHasCheckableAssignment(element: GrammarAST.AbstractElement): boolean {
  if (GrammarUtils.isOptionalCardinality(element.cardinality, element)) {
    return false;
  }
  if (GrammarAST.isAssignment(element)) {
    return element.operator !== '?=';
  }
  if (GrammarAST.isAction(element)) {
    return true;
  }
  const withElements = element as unknown as { elements?: GrammarAST.AbstractElement[] };
  if (Array.isArray(withElements.elements)) {
    return withElements.elements.some((child) => branchHasCheckableAssignment(child));
  }
  return false;
}

/**
 * Finds the first `Action` (`{infer Type.feature=current}` or `{infer Type}`)
 * anywhere in a branch's subtree and returns the type name it infers, if any.
 * A branch with no `Action` infers no type of its own (it's a plain sub-group
 * of the enclosing rule's own type).
 */
function branchInferredTypeName(element: GrammarAST.AbstractElement): string | undefined {
  if (GrammarAST.isAction(element)) {
    return element.inferredType?.name;
  }
  const withElements = element as unknown as { elements?: GrammarAST.AbstractElement[] };
  if (Array.isArray(withElements.elements)) {
    for (const child of withElements.elements) {
      const found = branchInferredTypeName(child);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * Analyses an object type's properties to determine whether the grammar rule
 * that produces it has a top-level `Alternatives` group whose branches are
 * mutually exclusive property producers — meaning the parser can never produce
 * an instance where NONE of the branch-introduced properties are populated.
 *
 * Returns the flat union of branch-introduced property names (the "at least one
 * of" set) when:
 * - the rule has an `Alternatives` ancestor common to its properties' `astNodes`,
 * - that `Alternatives` is GUARANTEED TO EXECUTE — no `?`/`*` cardinality on the
 *   group itself or any ancestor element, no enclosing branch of an OUTER
 *   multi-way `Alternatives`, and no fragment-rule call-site boundary (an
 *   optional/starred/nested/optionally-called alternation may execute zero
 *   times, producing an object where every branch-introduced property is
 *   absent — the refinement would wrongly reject that legitimately-parsed
 *   shape),
 * - every branch of that `Alternatives` contains at least one CHECKABLE
 *   (non-flag) `Assignment`/`Action` (a bare keyword-only branch, or a branch
 *   containing only a boolean flag, means the object can legally have zero of
 *   the candidate properties populated, so the refinement is dropped entirely), and
 * - no single property is assigned on EVERY branch (such a property is already
 *   effectively mandatory; no refinement is needed).
 *
 * Boolean flag assignments (`?=`) are excluded from the returned set — Langium
 * always serialises them as `false` when absent, so their "presence" can never
 * distinguish an empty body from a populated one.
 *
 * Guards against a distinct false-positive shape: a rule like
 * `A (op1 {infer Foo.x=current} ... | op2 {infer Bar.y=current} ...)*`, where
 * an `Alternatives` selects between producing DIFFERENT inferred types (a
 * type-union rule, not an intra-type alternation). Each branch's inferred type
 * name (via the nearest `Action`) is compared against `typeName`; if any
 * branch's subtree infers a DIFFERENT type, the whole `Alternatives` is
 * irrelevant to this type's structure and is skipped.
 *
 * Returns `undefined` when the rule has no top-level `Alternatives` describing
 * its OWN type, when that `Alternatives` is not guaranteed to execute, when any
 * branch is keyword-only, or when a property spans every branch.
 */
export function resolveAtLeastOneOf(
  typeName: string,
  properties: readonly PropertyLike[]
): string[] | undefined {
  // Map each candidate property to the set of branch indices it appears under
  // (within a single shared Alternatives ancestor). Properties with astNodes
  // outside any Alternatives (or under a different Alternatives) are ignored.
  let sharedAlternatives: GrammarAST.Alternatives | undefined;
  const propertyBranches = new Map<string, Set<number>>();

  for (const property of properties) {
    if (!property.astNodes) {
      continue;
    }
    for (const node of property.astNodes) {
      const isFlagAssignment = GrammarAST.isAssignment(node) && node.operator === '?=';
      const found = findEnclosingBranch(node);
      if (!found) {
        continue;
      }
      if (!sharedAlternatives) {
        sharedAlternatives = found.alternatives;
      } else if (sharedAlternatives !== found.alternatives) {
        // Properties span more than one distinct Alternatives group — too
        // complex to reliably reason about; bail out.
        return undefined;
      }

      if (!isFlagAssignment) {
        let branches = propertyBranches.get(property.name);
        if (!branches) {
          branches = new Set();
          propertyBranches.set(property.name, branches);
        }
        branches.add(found.branchIndex);
      }
    }
  }

  if (!sharedAlternatives || sharedAlternatives.elements.length < 2) {
    return undefined;
  }

  // The Alternatives group itself must be GUARANTEED TO EXECUTE — reject any
  // `?`/`*` cardinality on the group or any ancestor element up to the
  // ParserRule (an optional/starred alternation may execute zero times,
  // producing an object where every branch-introduced property is absent —
  // exactly the shape the refinement would wrongly reject), one branch of an
  // OUTER multi-way Alternatives (nested alternation, same reasoning), and any
  // fragment-rule boundary (the call site's cardinality is invisible from
  // here — conservatively treat as optional, mirroring array-min-occurrence's
  // fragment handling).
  if (!isMandatoryOccurrence(sharedAlternatives)) {
    return undefined;
  }

  // Every branch must belong to `typeName` — a branch whose subtree infers a
  // DIFFERENT type means this Alternatives selects between producing distinct
  // types (a type-union rule), not alternative property-sets of `typeName`.
  const everyBranchOwnsType = sharedAlternatives.elements.every((branchElement) => {
    const inferred = branchInferredTypeName(branchElement);
    return inferred === undefined || inferred === typeName;
  });
  if (!everyBranchOwnsType) {
    return undefined;
  }

  // Every branch of the Alternatives must guarantee at least one CHECKABLE
  // (non-flag) assignment — a keyword-only branch, or a branch containing only
  // a boolean flag, means the object can legally have none of the candidate
  // properties populated.
  const everyBranchAssigns = sharedAlternatives.elements.every((branchElement) =>
    branchHasCheckableAssignment(branchElement)
  );
  if (!everyBranchAssigns) {
    return undefined;
  }

  const branchCount = sharedAlternatives.elements.length;
  const atLeastOneOf = new Set<string>();
  for (const [propertyName, branches] of propertyBranches) {
    // A property assigned on every branch is already effectively mandatory —
    // no refinement is needed (and including it would make the check vacuous).
    if (branches.size >= branchCount) {
      return undefined;
    }
    atLeastOneOf.add(propertyName);
  }

  return atLeastOneOf.size > 0 ? [...atLeastOneOf] : undefined;
}
