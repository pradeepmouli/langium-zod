import { GrammarAST, GrammarUtils } from 'langium';
import type { AstNode } from 'langium';

/**
 * True when `node` (any grammar `AbstractElement` — an `Assignment`/`Action`,
 * or an `Alternatives` group itself) sits on an UNCONDITIONAL path: neither it
 * nor any `AbstractElement` ancestor up to the `ParserRule` carries an optional
 * cardinality (`?` or `*`), and no ancestor is a branch of a multi-branch
 * `Alternatives`. A single branch of an N-way choice is conditional even
 * without a `?`/`*` cardinality — a valid document may take a different branch,
 * so anything that only occurs on ONE branch of a choice cannot be guaranteed.
 *
 * Also handles the fragment-boundary case (PR #96): a fragment-defined
 * element's `$container` chain ends at the fragment `ParserRule`, not the call
 * site, so use-site cardinality (e.g. `(Frag)*`) is invisible to this walk. We
 * cannot prove the fragment is unconditionally called from every caller —
 * conservatively treat fragment-defined content as optional.
 *
 * `UnorderedGroup` (`A & B`) is intentionally NOT treated as optional: every
 * element in an unordered group must occur, so both contribute mandatorily.
 *
 * Shared by `array-min-occurrence.ts` (per-assignment `+=` mandatory-occurrence
 * check) and `non-empty-body.ts` (whole-`Alternatives`-group mandatory-execution
 * check, called with the `Alternatives` node itself as `node`).
 */
export function isMandatoryOccurrence(node: AstNode): boolean {
  let el: AstNode | undefined = node;
  while (el && GrammarAST.isAbstractElement(el)) {
    const element = el as GrammarAST.AbstractElement;
    if (GrammarUtils.isOptionalCardinality(element.cardinality, element)) {
      return false;
    }
    const parent: AstNode | undefined = el.$container;
    // One branch of an N-way choice is conditional even without a '?'/'*'.
    if (parent && GrammarAST.isAlternatives(parent) && parent.elements.length > 1) {
      return false;
    }
    el = parent;
  }
  // Fragment-defined assignment: the $container chain ends at the fragment rule,
  // not the use site, so use-site cardinality (e.g. `(Frag)*`) is invisible here.
  // We cannot prove ≥1 at every caller — conservatively treat as optional.
  if (el && GrammarAST.isParserRule(el) && el.fragment) {
    return false;
  }
  return true;
}

/**
 * Array minimum length derived from the grammar Assignment nodes that produce an
 * array property (`Property.astNodes`). Returns `1` when ANY `+=` assignment for
 * the property occurs on a mandatory path — covering both `x+=A+` and the
 * comma-list idiom `x+=A (',' x+=A)*` (where the first `x+=A` is mandatory and
 * the repeated one sits in a `*` group). Returns `undefined` otherwise.
 */
export function arrayMinFromAstNodes(astNodes: ReadonlySet<AstNode> | undefined): number | undefined {
  if (!astNodes) return undefined;
  for (const node of astNodes) {
    const isArrayAssign =
      (GrammarAST.isAssignment(node) && node.operator === '+=') ||
      (GrammarAST.isAction(node) && node.operator === '+=');
    if (isArrayAssign && isMandatoryOccurrence(node)) {
      return 1;
    }
  }
  return undefined;
}
