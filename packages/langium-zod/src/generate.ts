// SPDX-License-Identifier: MIT
/**
 * Programmatic generation core for langium-zod.
 *
 * This module holds the {@link generate} entry point and the configuration/types
 * it needs. It deliberately contains **no** `#!` shebang and no `process.argv`
 * parsing, so that re-exporting `generate` from the package's main entry
 * (`index.ts`) does not drag a shebang-bearing module into a consumer's bundle
 * graph. The thin CLI wrapper (`cli.ts`) imports from here.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { URI } from 'langium';
import { createLangiumGrammarServices, resolveImportUri } from 'langium/grammar';
import { NodeFileSystem } from 'langium/node';
import { generateZodSchemas, generateDomainSchemas, generateNamespaceOpsSchemas } from './api.js';
import { resolveAstTypesPath } from './conformance.js';
import type { ZodGeneratorConfig } from './config.js';
import type { Grammar, LangiumDocument } from 'langium';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** User-facing config file shape (langium-zod.config.js / .ts) */
export interface LangiumZodConfig extends Omit<
  ZodGeneratorConfig,
  'grammar' | 'services' | 'astTypes'
> {
  /**
   * Path to `langium-config.json`. Defaults to `langium-config.json` in cwd.
   * Only used when picked up via the CLI; programmatic API ignores it.
   */
  langiumConfig?: string;
  /** Explicit output path. Overrides derived path from langium-config.json `out` field. */
  outputPath?: string;
}

interface LangiumConfigJson {
  projectName?: string;
  out?: string;
  astTypes?: string;
  languages?: Array<{ grammar: string }>;
}

/**
 * Returns the subset of `requested` names that are not present in
 * `availableTypeNames`.
 *
 * Used to surface warnings when the user's `--include` or `--exclude` list
 * references type names that do not exist in the parsed grammar, helping catch
 * typos before generation runs.
 *
 * @param requested - The type names requested by the user (include or exclude
 *   list). Returns an empty array immediately when this is `undefined` or empty.
 * @param availableTypeNames - All type names present in the parsed Langium grammar
 *   (both interface types and union/datatype rule types).
 * @returns An array of names from `requested` that are absent from
 *   `availableTypeNames`.
 */
export function getUnknownFilterNames(
  requested: string[] | undefined,
  availableTypeNames: string[]
): string[] {
  if (!requested || requested.length === 0) {
    return [];
  }

  const available = new Set(availableTypeNames);
  return requested.filter((name) => !available.has(name));
}

function warnUnknownFilterNames(
  filterName: 'include' | 'exclude',
  requested: string[] | undefined,
  availableTypeNames: string[]
): void {
  const unknown = getUnknownFilterNames(requested, availableTypeNames);
  if (unknown.length === 0) {
    return;
  }

  const availableList = availableTypeNames.length > 0 ? availableTypeNames.join(', ') : '(none)';
  console.warn(
    `Warning: Unknown ${filterName} type name(s): ${unknown.join(', ')}. Available types: ${availableList}`
  );
}

/**
 * Recursively load imported grammar files so that DocumentBuilder can link
 * cross-file references correctly (mirrors langium-cli's eagerLoad strategy).
 */
async function eagerLoad(
  document: LangiumDocument,
  documents: { getOrCreateDocument: (uri: URI) => Promise<LangiumDocument> },
  visited: Set<string> = new Set()
): Promise<void> {
  const key = document.uri.toString();
  if (visited.has(key)) return;
  visited.add(key);

  const grammar = document.parseResult?.value as Grammar | undefined;
  if (!grammar) return;

  // Grammar.imports is an array of GrammarImport nodes; resolveImportUri handles the URI
  const imports = (grammar as Grammar & { imports?: unknown[] }).imports ?? [];
  for (const imp of imports) {
    const importUri = resolveImportUri(imp as Parameters<typeof resolveImportUri>[0]);
    if (importUri) {
      const importedDoc = await documents.getOrCreateDocument(importUri);
      await eagerLoad(importedDoc, documents, visited);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Core generate logic (can be called programmatically)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Options accepted by the programmatic {@link generate} function.
 *
 * Allows the core generation logic to be invoked directly from other tools or
 * scripts without going through the CLI argument parser.
 */
export interface GenerateOptions {
  /** Absolute path to langium-config.json */
  langiumConfigPath: string;
  /** Merged generator config (from user's langium-zod.config.js + CLI flags) */
  config?: LangiumZodConfig;
}

/**
 * Programmatic entry point for the `langium-zod generate` command.
 *
 * Loads `langium-config.json` from `opts.langiumConfigPath`, resolves the grammar
 * file path, parses the grammar with Langium services (including eager import
 * loading so cross-file references link correctly), then calls
 * {@link generateZodSchemas} with the merged configuration. Prints a success
 * message to stdout when generation completes.
 *
 * @param opts - {@link GenerateOptions} specifying the langium config path and
 *   optional pre-merged generator config.
 * @throws `Error` when the langium-config.json or grammar file cannot be found, or
 *   when the config defines no languages.
 *
 * @example
 * ```ts
 * import { generate } from 'langium-zod';
 * import { resolve } from 'node:path';
 *
 * await generate({
 *   langiumConfigPath: resolve(process.cwd(), 'langium-config.json'),
 *   config: {
 *     outputPath: 'src/generated/zod-schemas.ts',
 *     stripInternals: true,
 *   },
 * });
 * // Prints: ✓ Generated Zod schemas → src/generated/zod-schemas.ts
 * ```
 */
export async function generate(opts: GenerateOptions): Promise<void> {
  const { langiumConfigPath } = opts;
  const userConfig: LangiumZodConfig = opts.config ?? {};

  // ── 1. Load langium-config.json ─────────────────────────────────────────
  if (!existsSync(langiumConfigPath)) {
    throw new Error(`langium-config.json not found: ${langiumConfigPath}`);
  }
  const langiumConfig: LangiumConfigJson = JSON.parse(readFileSync(langiumConfigPath, 'utf8'));

  const configDir = dirname(langiumConfigPath);
  const languages = langiumConfig.languages;

  if (!languages || languages.length === 0) {
    throw new Error('No languages defined in langium-config.json');
  }

  const grammarRelPath = languages[0]!.grammar;
  const grammarAbsPath = resolve(configDir, grammarRelPath);

  if (!existsSync(grammarAbsPath)) {
    throw new Error(`Grammar file not found: ${grammarAbsPath}`);
  }

  // ── 2. Resolve output path ───────────────────────────────────────────────
  const outDir = langiumConfig.out
    ? resolve(configDir, langiumConfig.out)
    : resolve(configDir, 'src/generated');
  const outputPath: string = userConfig.outputPath ?? join(outDir, 'zod-schemas.ts');

  const conformanceConfig = userConfig.conformance;
  if (conformanceConfig) {
    const resolvedAstTypesPath = conformanceConfig.astTypesPath
      ? resolve(configDir, conformanceConfig.astTypesPath)
      : langiumConfig.astTypes
        ? resolve(configDir, langiumConfig.astTypes)
        : resolveAstTypesPath(configDir, outDir);

    if (!existsSync(resolvedAstTypesPath)) {
      throw new Error(`Unable to resolve ast types path for conformance: ${resolvedAstTypesPath}`);
    }

    userConfig.conformance = {
      astTypesPath: resolvedAstTypesPath,
      outputPath: conformanceConfig.outputPath
    };
  }

  // ── 3. Parse grammar using Langium services ──────────────────────────────
  const { shared, grammar: grammarServices } = createLangiumGrammarServices(NodeFileSystem);
  void grammarServices; // used only for type-checking if needed later

  const langiumDocuments = shared.workspace.LangiumDocuments;
  const documentBuilder = shared.workspace.DocumentBuilder;

  const grammarUri = URI.file(grammarAbsPath);
  const entryDocument = await langiumDocuments.getOrCreateDocument(grammarUri);

  // Recursively load imported files so references resolve correctly
  await eagerLoad(entryDocument, langiumDocuments);

  // Build (parse + link) all loaded documents
  await documentBuilder.build(langiumDocuments.all.toArray(), {
    validation: false
  });

  const grammar = entryDocument.parseResult.value as Grammar;
  const availableTypeNames = [
    ...(grammar.interfaces ?? []).map((entry) => entry.name),
    ...(grammar.types ?? []).map((entry) => entry.name)
  ]
    .filter((name): name is string => typeof name === 'string')
    .sort((left, right) => left.localeCompare(right));

  warnUnknownFilterNames('include', userConfig.include, availableTypeNames);
  warnUnknownFilterNames('exclude', userConfig.exclude, availableTypeNames);

  // ── 4. Generate schemas ──────────────────────────────────────────────────
  const {
    langiumConfig: _ignored,
    outputPath: _op,
    emitDomain: _emitDomain,
    domainOutputPath: _domainOutputPath,
    domainOnly: _domainOnly,
    namespaceOps: _namespaceOps,
    namespaceOpsOutputPath: _namespaceOpsOutputPath,
    ...restConfig
  } = userConfig;

  if (!userConfig.domainOnly) {
    generateZodSchemas({
      grammar,
      outputPath,
      ...restConfig
    });
    console.log(`✓ Generated Zod schemas → ${outputPath}`);
  }

  if (userConfig.emitDomain || userConfig.domainOnly) {
    const domainOutputPath = userConfig.domainOutputPath ?? join(outDir, 'domain.ts');
    generateDomainSchemas({
      grammar,
      domainOutputPath,
      stripInternals: restConfig.stripInternals,
      projection: restConfig.projection,
      domainOverlays: restConfig.domainOverlays,
      include: restConfig.include,
      exclude: restConfig.exclude
    });
    console.log(`✓ Generated domain surface → ${domainOutputPath}`);
  }

  if (userConfig.namespaceOps) {
    const namespaceOpsOutputPath = userConfig.namespaceOpsOutputPath ?? join(outDir, 'domain.ts');
    generateNamespaceOpsSchemas({
      grammar,
      namespaceOpsOutputPath,
      include: restConfig.include,
      exclude: restConfig.exclude
    });
    console.log(`✓ Generated namespace-ops surface → ${namespaceOpsOutputPath}`);
  }
}
