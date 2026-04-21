import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { collectAst } from 'langium/grammar';
import type { ZodGeneratorConfig } from './config.js';
import { generateConformanceSource, inferConformanceOutputPath } from './conformance.js';
import { ZodGeneratorError } from './errors.js';
import { extractTypeDescriptors } from './extractor.js';
import { generateZodCode } from './generator.js';
import { applyProjectionToDescriptors, resolveEffectiveStripFields } from './projection.js';
import { detectRecursiveTypes } from './recursion-detector.js';
import type { AstTypesLike, ZodRegexEnumDescriptor, ZodTypeDescriptor } from './types.js';

export type PublicZodGeneratorConfig = ZodGeneratorConfig;

function resolveAstTypes(astTypes: AstTypesLike): AstTypesLike {
  return {
    interfaces: astTypes.interfaces ?? [],
    unions: astTypes.unions ?? []
  };
}

/**
 * Main entry point for programmatic Zod schema generation from a Langium grammar.
 *
 * Accepts a {@link ZodGeneratorConfig} that specifies either a parsed Langium
 * `Grammar` object or a pre-built {@link AstTypesLike} descriptor, then runs the
 * full extraction → projection → code-generation pipeline and returns the
 * generated TypeScript source as a string. When `config.outputPath` is set the
 * result is also written to disk. Conformance artifacts are generated when
 * `config.conformance` is provided.
 *
 * @remarks
 * This is the primary API for most consumers. It combines {@link extractTypeDescriptors},
 * {@link detectRecursiveTypes}, and {@link generateZodCode} into a single call. Use the
 * lower-level functions directly only when you need fine-grained control over individual
 * pipeline stages (e.g. to inspect descriptors before code generation, or to cache
 * extraction results across multiple code-generation runs).
 *
 * The function is synchronous and writes to disk only when `config.outputPath` is set.
 * It does not shell out or spawn child processes.
 *
 * **Config option decision tree:**
 * - Does your grammar have recursive rules (e.g. `Expression: ... | left=Expression`)? →
 *   no action needed; cycle detection is automatic. If you run a custom pipeline, pass the
 *   *full* (unprojected) descriptor set to `detectRecursiveTypes` first.
 * - Does your grammar have cross-references (`ref:` properties)? →
 *   if you need runtime ref-text validation in a live language server, enable
 *   `crossRefValidation: true` and use the emitted `create*Schema()` factories.
 *   Otherwise leave it off — unconstrained `ReferenceSchema` is lighter and sufficient for
 *   batch/offline validation.
 * - Do you want to strip Langium internal bookkeeping fields (`$container`, `$document`,
 *   `$cstNode`, etc.)? → set `stripInternals: true`. These fields are never meaningful
 *   in a validation context and inflate the generated schema.
 * - Do you need form labels and descriptions driven by the grammar? → enable `formMetadata: true`.
 *   Only properties whose grammar rule has a JSDoc/grammar comment get a `description`; every
 *   property gets a humanized `title` regardless.
 * - Are you using Zod 4's `z.looseObject`? → the default `objectStyle: 'loose'` emits
 *   `z.looseObject(...)`. Switch to `objectStyle: 'strict'` + `.strict()` on the schema only
 *   when you need hard rejection of unknown properties (e.g. strict API request validation).
 *
 * @param config - Generator configuration including the grammar or AST types,
 *   optional output path, include/exclude filters, projection, and feature flags.
 * @returns The generated TypeScript source containing all Zod schema exports.
 * @throws {@link ZodGeneratorError} when required configuration is missing, when
 *   `conformance` is enabled without `outputPath`, or when a grammar property type
 *   cannot be mapped to a Zod schema.
 *
 * @example
 * ```ts
 * import { createLangiumGrammarServices } from 'langium/grammar';
 * import { NodeFileSystem } from 'langium/node';
 * import { generateZodSchemas } from 'langium-zod';
 *
 * const { grammar } = createLangiumGrammarServices(NodeFileSystem);
 * // assume `parsedGrammar` is a Grammar node obtained from Langium
 * const source = generateZodSchemas({
 *   grammar: parsedGrammar,
 *   outputPath: 'src/generated/zod-schemas.ts',
 *   stripInternals: true,
 * });
 * console.log(source); // TypeScript source with Zod schema exports
 * ```
 *
 * @example
 * ```ts
 * // Using a pre-built AstTypesLike descriptor (skips grammar parsing)
 * import { generateZodSchemas } from 'langium-zod';
 * import { collectAst } from 'langium/grammar';
 *
 * const astTypes = collectAst(myGrammar);
 * const source = generateZodSchemas({ astTypes });
 * ```
 *
 * @useWhen
 * - You have a parsed Langium `Grammar` object and want Zod schemas as a TypeScript string.
 * - You are integrating langium-zod into a build pipeline (Vite plugin, codegen script, etc.).
 * - You need conformance artifacts (type-guard files) alongside the schema output.
 * - You want to write generated schemas to disk in a single call.
 *
 * @avoidWhen
 * - You only need to inspect the intermediate type descriptors without generating code —
 *   use {@link extractTypeDescriptors} directly instead.
 * - You are running inside the Langium DI container — prefer {@link DefaultZodSchemaGenerator}
 *   which injects services automatically.
 * - You want to generate schemas for only a subset of types at runtime — pass `include`/`exclude`
 *   in the config rather than post-processing the output.
 *
 * @never
 * - NEVER omit both `grammar` and `astTypes` — the function throws {@link ZodGeneratorError}
 *   immediately. BECAUSE there is no default grammar source and no way to recover silently.
 *   FIX: provide at least `{ grammar: parsedGrammar }` or `{ astTypes: collectAst(grammar) }`.
 * - NEVER enable `conformance` without setting `outputPath` — the function will throw before
 *   writing any output. BECAUSE the conformance module needs to derive a sibling output path
 *   from the schema file's directory. FIX: always set `outputPath` when `conformance` is truthy.
 * - NEVER pass a `Grammar[]` array when grammars share type names across files without
 *   verifying that Langium's `collectAst()` merges them correctly. BECAUSE duplicate type names
 *   will silently overwrite each other in the type map, producing truncated schemas.
 *   FIX: run `collectAst` separately and inspect the merged map before generation.
 * - NEVER call with `crossRefValidation: true` on grammars with no cross-reference properties —
 *   it emits dead `create*Schema` factory functions that add noise without benefit.
 *   FIX: only enable `crossRefValidation` when your grammar has at least one `ref:` property.
 * - NEVER remove the `// @ts-nocheck` comment from generated output files. BECAUSE the
 *   getter-based recursive property syntax (emitted for self-referential types) is not always
 *   accepted by TypeScript's strict object-literal type checker — removing the comment causes
 *   immediate TS build failures in grammars with recursive rules. FIX: treat generated files as
 *   opaque artifacts; place any hand-written extensions in a separate file that imports the schema.
 * - NEVER commit generated schemas as the sole copy of your schema logic. BECAUSE any grammar
 *   edit (new rule, renamed property, changed cardinality) produces stale schemas that pass
 *   TypeScript but fail at Zod validation runtime. FIX: wire `langium-zod generate` as a
 *   pre-build or CI step so schema freshness is enforced automatically.
 *
 * @category Generation
 * @see {@link extractTypeDescriptors}
 * @see {@link detectRecursiveTypes}
 * @see {@link generateZodCode}
 * @see {@link ZodGeneratorConfig}
 */
export function generateZodSchemas(config: ZodGeneratorConfig): string {
  let rawAstTypes: AstTypesLike;
  if (config.astTypes) {
    rawAstTypes = config.astTypes;
  } else if (config.grammar) {
    rawAstTypes = collectAst(config.grammar) as unknown as AstTypesLike;
  } else {
    throw new ZodGeneratorError('Missing grammar or astTypes in ZodGeneratorConfig', {
      suggestion: "Provide astTypes from Langium's collectAst() or pass a grammar object"
    });
  }

  const astTypes = resolveAstTypes(rawAstTypes);
  const rawDescriptors = buildDescriptorPipeline(astTypes, config);

  // Apply regexOverrides: upgrade primitive-alias schemas to regex-enum for types
  // whose Langium grammar rule is too complex for automatic regex derivation.
  const overrides = config.regexOverrides ?? {};
  const descriptors: ZodTypeDescriptor[] = rawDescriptors.map((d) => {
    const override = overrides[d.name];
    if (override && (d.kind === 'primitive-alias' || d.kind === 'regex-enum')) {
      return {
        name: d.name,
        kind: 'regex-enum',
        regex: override,
        keywords: d.kind === 'regex-enum' ? (d as ZodRegexEnumDescriptor).keywords : []
      } satisfies ZodRegexEnumDescriptor;
    }
    return d;
  });

  const recursiveTypes = detectRecursiveTypes(descriptors);
  const surfaceDescriptors = applyProjectionToDescriptors(descriptors, {
    projection: config.projection,
    stripInternals: config.stripInternals
  });
  const source = generateZodCode(descriptors, recursiveTypes, {
    projection: config.projection,
    stripInternals: config.stripInternals,
    crossRefValidation: config.crossRefValidation,
    formMetadata: config.formMetadata,
    objectStyle: config.objectStyle
  });

  if (config.outputPath) {
    mkdirSync(dirname(config.outputPath), { recursive: true });
    writeFileSync(config.outputPath, source, 'utf8');
  }

  if (config.conformance) {
    if (!config.outputPath) {
      throw new ZodGeneratorError('Conformance generation requires outputPath', {
        suggestion: 'Provide outputPath when conformance generation is enabled'
      });
    }

    if (!config.conformance.astTypesPath) {
      throw new ZodGeneratorError('Conformance generation requires astTypesPath', {
        suggestion: 'Provide conformance.astTypesPath or use CLI --ast-types/auto-resolution'
      });
    }

    const schemaTypeNames = surfaceDescriptors
      .filter((descriptor) => descriptor.kind === 'object')
      .map((descriptor) => descriptor.name);

    if (schemaTypeNames.length === 0) {
      console.warn(
        'Warning: Conformance generation skipped because no schemas remain after filtering.'
      );
      return source;
    }

    const conformanceOutputPath = inferConformanceOutputPath(
      config.outputPath,
      config.conformance.outputPath
    );
    const conformance = generateConformanceSource({
      schemaOutputPath: config.outputPath,
      conformanceOutputPath,
      astTypesPath: config.conformance.astTypesPath,
      schemaTypeNames,
      stripFields: resolveEffectiveStripFields({
        projection: config.projection,
        stripInternals: config.stripInternals
      }),
      projection: config.projection
    });

    for (const missingType of conformance.missingAstTypes) {
      console.warn(`Warning: Missing AST export for conformance type ${missingType}; skipping.`);
    }

    mkdirSync(dirname(conformanceOutputPath), { recursive: true });
    writeFileSync(conformanceOutputPath, conformance.source, 'utf8');
  }

  return source;
}

function buildDescriptorPipeline(
  astTypes: AstTypesLike,
  config: ZodGeneratorConfig
): ZodTypeDescriptor[] {
  const descriptors = extractTypeDescriptors(astTypes, {
    include: config.include,
    exclude: config.exclude
  });

  return descriptors;
}
