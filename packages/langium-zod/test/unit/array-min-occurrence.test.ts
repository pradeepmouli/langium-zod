import { describe, it, expect } from 'vitest';
import { arrayMinFromAstNodes } from '../../src/array-min-occurrence.js';

// Hand-built grammar element nodes. Langium's GrammarAST predicates key off
// `$type`, so plain objects with the right `$type` + `$container` chain suffice.
const RULE = { $type: 'ParserRule' } as never; // not an AbstractElement → walk stops
function assignment(operator: '+=' | '=' | '?=', cardinality: '*' | '+' | '?' | undefined, container: unknown) {
  return { $type: 'Assignment', operator, cardinality, $container: container } as never;
}
function group(cardinality: '*' | '+' | '?' | undefined, container: unknown) {
  return { $type: 'Group', cardinality, $container: container } as never;
}
function alternatives(elementCount: number, container: unknown) {
  return { $type: 'Alternatives', cardinality: undefined, elements: Array(elementCount).fill({}), $container: container } as never;
}

describe('arrayMinFromAstNodes', () => {
  it('returns 1 for a mandatory += assignment directly under the rule', () => {
    expect(arrayMinFromAstNodes(new Set([assignment('+=', undefined, RULE)]))).toBe(1);
  });

  it('returns 1 for the comma-list idiom (first mandatory, second inside a * group)', () => {
    const first = assignment('+=', undefined, RULE);
    const star = group('*', RULE);
    const second = assignment('+=', undefined, star);
    expect(arrayMinFromAstNodes(new Set([first, second]))).toBe(1);
  });

  it('returns undefined when every contributing assignment is optional', () => {
    const star = group('*', RULE);
    expect(arrayMinFromAstNodes(new Set([assignment('+=', undefined, star)]))).toBeUndefined();
  });

  it('returns 1 for an explicit + cardinality assignment', () => {
    expect(arrayMinFromAstNodes(new Set([assignment('+=', '+', RULE)]))).toBe(1);
  });

  it('returns undefined for a non-array (=) assignment', () => {
    expect(arrayMinFromAstNodes(new Set([assignment('=', undefined, RULE)]))).toBeUndefined();
  });

  it('returns undefined for empty/absent astNodes', () => {
    expect(arrayMinFromAstNodes(undefined)).toBeUndefined();
    expect(arrayMinFromAstNodes(new Set())).toBeUndefined();
  });

  it('returns undefined when the += assignment is inside an Alternatives branch (N-way choice)', () => {
    // `'all' | items+=Item (…)*` — the assignment sits inside a 2-branch Alternatives;
    // a document taking the other branch has items:[] which fails .min(1).
    const alt = alternatives(2, RULE);
    expect(arrayMinFromAstNodes(new Set([assignment('+=', undefined, alt)]))).toBeUndefined();
  });

  it('returns undefined when the += assignment is inside a fragment rule', () => {
    // Fragment-defined assignments end their $container chain at the fragment rule,
    // NOT the (optional) use site — e.g. `(Frag)*` — so use-site cardinality is
    // invisible. Conservatively treat as optional.
    const fragmentRule = { $type: 'ParserRule', fragment: true, $container: undefined } as never;
    expect(arrayMinFromAstNodes(new Set([assignment('+=', undefined, fragmentRule)]))).toBeUndefined();
  });
});
