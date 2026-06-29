import { GrammarAST, GrammarUtils } from 'langium';
import type { AstNode } from 'langium';

/**
 * True when `node` (a grammar Assignment/Action) contributes on an UNCONDITIONAL
 * path: neither it nor any AbstractElement ancestor up to the ParserRule carries
 * an optional cardinality (`?` or `*`). `+` and absent cardinality are mandatory.
 */
function isMandatoryOccurrence(node: AstNode): boolean {
  let el: AstNode | undefined = node;
  while (el && GrammarAST.isAbstractElement(el)) {
    const element = el as GrammarAST.AbstractElement;
    if (GrammarUtils.isOptionalCardinality(element.cardinality, element)) {
      return false;
    }
    el = el.$container;
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
