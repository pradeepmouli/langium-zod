import { describe, it, expect } from 'vitest';
import { resolveAtLeastOneOf } from '../../src/non-empty-body.js';
import type { PropertyLike } from '../../src/types.js';

// Hand-built grammar element nodes, mirroring array-min-occurrence.test.ts's style.
// Langium's GrammarAST predicates key off `$type`, so plain objects with the right
// `$type` + `$container` chain suffice. Every helper takes the container as an
// argument and returns a fresh node — never mutates a node's own `$container`
// after other nodes have already captured a reference to it (that mutation
// pattern can accidentally create a self-referential `$container` cycle).
const RULE = { $type: 'ParserRule' } as never; // not an AbstractElement → walk stops

interface Node {
  $type: string;
  $container?: unknown;
  elements?: Node[];
  operator?: string;
  inferredType?: { name: string };
  cardinality?: '?' | '*' | '+';
  fragment?: boolean;
}

function assignment(name: string, operator: '=' | '+=' | '?=', container: unknown): Node {
  return { $type: 'Assignment', feature: name, operator, $container: container } as never;
}

function action(inferredTypeName: string, container: unknown): Node {
  return { $type: 'Action', inferredType: { name: inferredTypeName }, $container: container } as never;
}

/** A Group branch whose only child is a single Assignment (branchHasAssignment sees it via `elements`). */
function assignmentGroup(assignmentNode: Node, container: unknown): Node {
  const g: Node = { $type: 'Group', elements: [assignmentNode], $container: container };
  assignmentNode.$container = g;
  return g;
}

/** A Group branch with no Assignment anywhere in its subtree (bare keyword branch). */
function keywordGroup(container: unknown): Node {
  return { $type: 'Group', elements: [{ $type: 'Keyword' } as Node], $container: container };
}

function alternatives(
  branchFactories: Array<(container: Node) => Node>,
  container: unknown,
  cardinality?: '?' | '*' | '+'
): Node {
  const alt: Node = { $type: 'Alternatives', elements: [], $container: container, cardinality };
  alt.elements = branchFactories.map((factory) => factory(alt));
  return alt;
}

/** A Group wrapping a single child, with its own optional/starred cardinality. */
function optionalGroup(cardinality: '?' | '*', childFactory: (container: Node) => Node, container: unknown): Node {
  const g: Node = { $type: 'Group', elements: [], cardinality, $container: container };
  g.elements = [childFactory(g)];
  return g;
}

/** A fragment ParserRule — the $container chain for its content ends HERE,
 * making use-site (call-site) cardinality invisible to the analysis. */
function fragmentRule(): Node {
  return { $type: 'ParserRule', fragment: true } as never;
}

function prop(name: string, astNodes: Node[]): PropertyLike {
  return { name, astNodes: new Set(astNodes as never[]) };
}

describe('resolveAtLeastOneOf', () => {
  it('returns the branch-introduced property union for a 5-way alternatives (RosettaSynonymBody shape)', () => {
    // (values+=X | hints+=X | merge=X | mappingLogic=X | metaValues+=X) (optional trailing group)
    const values = assignment('values', '+=', undefined);
    const hints = assignment('hints', '+=', undefined);
    const merge = assignment('merge', '=', undefined);
    const mappingLogic = assignment('mappingLogic', '=', undefined);
    const metaValues = assignment('metaValues', '+=', undefined);

    alternatives(
      [
        (c) => assignmentGroup(values, c),
        (c) => assignmentGroup(hints, c),
        (c) => assignmentGroup(merge, c),
        (c) => assignmentGroup(mappingLogic, c),
        (c) => assignmentGroup(metaValues, c)
      ],
      RULE
    );

    const properties = [
      prop('values', [values]),
      prop('hints', [hints]),
      prop('merge', [merge]),
      prop('mappingLogic', [mappingLogic]),
      prop('metaValues', [metaValues]),
      prop('format', []), // trailing optional clause, not part of the alternation
      prop('patternMatch', [])
    ];

    const result = resolveAtLeastOneOf('Test', properties);
    expect(result).toEqual(
      expect.arrayContaining(['values', 'hints', 'merge', 'mappingLogic', 'metaValues'])
    );
    expect(result).toHaveLength(5);
    expect(result).not.toContain('format');
    expect(result).not.toContain('patternMatch');
  });

  it('excludes boolean flags (?=) from a branch — RosettaMappingInstance shape', () => {
    // ('set' 'when') when=X | (default?='default' 'to') set=X
    const when = assignment('when', '=', undefined);
    const defaultFlag = assignment('default', '?=', undefined);
    const set = assignment('set', '=', undefined);

    alternatives(
      [
        (c) => assignmentGroup(when, c),
        (c) => {
          const g: Node = { $type: 'Group', elements: [defaultFlag, set], $container: c };
          defaultFlag.$container = g;
          set.$container = g;
          return g;
        }
      ],
      RULE
    );

    const properties = [prop('when', [when]), prop('default', [defaultFlag]), prop('set', [set])];

    const result = resolveAtLeastOneOf('Test', properties);
    expect(result).toEqual(expect.arrayContaining(['when', 'set']));
    expect(result).not.toContain('default');
    expect(result).toHaveLength(2);
  });

  it('returns undefined when the rule has no top-level Alternatives', () => {
    const properties = [prop('name', [assignment('name', '=', RULE)])];
    expect(resolveAtLeastOneOf('Test', properties)).toBeUndefined();
  });

  it('returns undefined when a property is assigned on every branch (already effectively mandatory)', () => {
    // `kind` is assigned in both branches — the object is never missing `kind`,
    // so no refinement is needed regardless of which other props are present.
    const kindA = assignment('kind', '=', undefined);
    const kindB = assignment('kind', '=', undefined);
    const extra = assignment('extra', '=', undefined);

    alternatives(
      [
        (c) => assignmentGroup(kindA, c),
        (c) => {
          const g: Node = { $type: 'Group', elements: [kindB, extra], $container: c };
          kindB.$container = g;
          extra.$container = g;
          return g;
        }
      ],
      RULE
    );

    const properties = [prop('kind', [kindA, kindB]), prop('extra', [extra])];
    expect(resolveAtLeastOneOf('Test', properties)).toBeUndefined();
  });

  it('returns undefined when any branch is empty (keyword-only branch, object can be argument-less)', () => {
    const value = assignment('value', '=', undefined);
    alternatives([(c) => assignmentGroup(value, c), (c) => keywordGroup(c)], RULE);

    const properties = [prop('value', [value])];
    expect(resolveAtLeastOneOf('Test', properties)).toBeUndefined();
  });

  it('returns undefined when a branch has ONLY a boolean flag (RuleReferenceAnnotation shape)', () => {
    // (reportingRule=[Rule:QualifiedName] | empty?='empty') — the second branch
    // has no checkable (non-flag) assignment at all, so a legitimately-parsed
    // document taking that branch has `reportingRule` undefined. A refinement
    // keyed only on `reportingRule` would wrongly reject that valid document —
    // THE HARD INVARIANT violation this test guards against.
    const reportingRule = assignment('reportingRule', '=', undefined);
    const emptyFlag = assignment('empty', '?=', undefined);

    alternatives(
      [(c) => assignmentGroup(reportingRule, c), (c) => assignmentGroup(emptyFlag, c)],
      RULE
    );

    const properties = [prop('reportingRule', [reportingRule]), prop('empty', [emptyFlag])];
    expect(resolveAtLeastOneOf('Test', properties)).toBeUndefined();
  });

  it('returns undefined for a single-branch (no Alternatives) rule even with many properties', () => {
    const properties = [
      prop('a', [assignment('a', '=', RULE)]),
      prop('b', [assignment('b', '=', RULE)])
    ];
    expect(resolveAtLeastOneOf('Test', properties)).toBeUndefined();
  });

  it('returns undefined when a branch infers a DIFFERENT type (type-union rule, not intra-type alternation)', () => {
    // Mirrors NestedAnnotationPath: `Primary ( {infer AnnotationPath.receiver=current} op1=... attr=[...]
    //   | {infer AnnotationDeepPath.receiver=current} op2=... attr=[...] )*` — the Alternatives selects
    // between producing AnnotationPath vs AnnotationDeepPath, two DIFFERENT types. When analysing
    // AnnotationDeepPath, its OWN properties (receiver/operator/attribute) all sit on the SAME
    // branch (the one inferring AnnotationDeepPath) — they are not competing alternatives of
    // AnnotationDeepPath and must NOT produce a (vacuously-true but misleading) refinement.
    const receiver = assignment('receiver', '=', undefined);
    const operatorProp = assignment('operator', '=', undefined);
    const attribute = assignment('attribute', '=', undefined);

    alternatives(
      [
        (c) => {
          // Branch A infers a sibling type (AnnotationPath) — irrelevant to AnnotationDeepPath.
          const g: Node = { $type: 'Group', elements: [action('AnnotationPath', c)], $container: c };
          return g;
        },
        (c) => {
          // Branch B infers AnnotationDeepPath itself; all three props live on this ONE branch.
          const act = action('AnnotationDeepPath', c);
          const g: Node = {
            $type: 'Group',
            elements: [act, operatorProp, attribute],
            $container: c
          };
          act.$container = g;
          receiver.$container = act; // receiver is the Action's own inferred feature
          operatorProp.$container = g;
          attribute.$container = g;
          return g;
        }
      ],
      RULE
    );

    const properties = [
      prop('receiver', [receiver]),
      prop('operator', [operatorProp]),
      prop('attribute', [attribute])
    ];

    expect(resolveAtLeastOneOf('AnnotationDeepPath', properties)).toBeUndefined();
  });

  it('returns undefined when the Alternatives itself carries an optional (?) cardinality (probe a1)', () => {
    // (a=STRING | b=INT)? — the alternation may execute zero times.
    const a = assignment('a', '=', undefined);
    const b = assignment('b', '=', undefined);
    alternatives([(c) => assignmentGroup(a, c), (c) => assignmentGroup(b, c)], RULE, '?');

    const properties = [prop('a', [a]), prop('b', [b])];
    expect(resolveAtLeastOneOf('Test', properties)).toBeUndefined();
  });

  it('returns undefined when the Alternatives itself is starred (probe a2)', () => {
    // ('add' adds+=S | 'rem' rems+=S)* — zero iterations is legal.
    const adds = assignment('adds', '+=', undefined);
    const rems = assignment('rems', '+=', undefined);
    alternatives([(c) => assignmentGroup(adds, c), (c) => assignmentGroup(rems, c)], RULE, '*');

    const properties = [prop('adds', [adds]), prop('rems', [rems])];
    expect(resolveAtLeastOneOf('Test', properties)).toBeUndefined();
  });

  it('returns undefined when a mandatory Alternatives is nested inside an optional ancestor Group (probe a3)', () => {
    // ('with' (a=STRING | b=INT))? — the alternation has no cardinality of its
    // own, but its enclosing Group is optional.
    const a = assignment('a', '=', undefined);
    const b = assignment('b', '=', undefined);
    optionalGroup(
      '?',
      (groupContainer) =>
        alternatives([(c) => assignmentGroup(a, c), (c) => assignmentGroup(b, c)], groupContainer),
      RULE
    );

    const properties = [prop('a', [a]), prop('b', [b])];
    expect(resolveAtLeastOneOf('Test', properties)).toBeUndefined();
  });

  it('returns undefined when the Alternatives is defined inside a fragment rule (probe d2)', () => {
    // Body? where fragment Body: (a=STRING | b=INT) — the fragment's content
    // is a mandatory alternation, but the CALL SITE (Body?) is optional; the
    // fragment's $container chain ends at the fragment ParserRule itself,
    // invisible to use-site cardinality (same class PR #96 fixed for array-min).
    const a = assignment('a', '=', undefined);
    const b = assignment('b', '=', undefined);
    alternatives(
      [(c) => assignmentGroup(a, c), (c) => assignmentGroup(b, c)],
      fragmentRule()
    );

    const properties = [prop('a', [a]), prop('b', [b])];
    expect(resolveAtLeastOneOf('Test', properties)).toBeUndefined();
  });
});
