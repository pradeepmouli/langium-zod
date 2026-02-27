#!/usr/bin/env node
/**
 * langium-zod CLI
 *
 * Usage:
 *   langium-zod generate [--config langium-config.json] [--out src/generated/zod-schemas.ts]
 *   langium-zod --help
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { URI } from 'langium';
import { createLangiumGrammarServices, resolveImportUri } from 'langium/grammar';
import { NodeFileSystem } from 'langium/node';
import { generateZodSchemas } from './api.js';
import { resolveAstTypesPath } from './conformance.js';
import type { ZodGeneratorConfig } from './config.js';
import { loadProjectionConfig } from './projection.js';
import type { Grammar, LangiumDocument } from 'langium';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** User-facing config file shape (langium-zod.config.js / .ts) */
export interface LangiumZodConfig
	extends Omit<ZodGeneratorConfig, 'grammar' | 'services' | 'astTypes'> {
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

function parseCsvList(value: string): string[] {
	const seen = new Set<string>();
	const parsed: string[] = [];

	for (const entry of value.split(',')) {
		const normalized = entry.trim();
		if (!normalized || seen.has(normalized)) {
			continue;
		}
		seen.add(normalized);
		parsed.push(normalized);
	}

	return parsed;
}

function getArgValue(args: string[], flag: string): string | undefined {
	const idx = args.indexOf(flag);
	if (idx < 0) {
		return undefined;
	}

	const value = args[idx + 1];
	if (value == null || value.startsWith('--')) {
		throw new Error(`Missing value for ${flag}`);
	}

	return value;
}

export function resolveFilterOverrides(
	base: Pick<LangiumZodConfig, 'include' | 'exclude'>,
	includeArg?: string,
	excludeArg?: string,
): Pick<LangiumZodConfig, 'include' | 'exclude'> {
	const includeFromCli = includeArg === undefined ? undefined : parseCsvList(includeArg);
	const excludeFromCli = excludeArg === undefined ? undefined : parseCsvList(excludeArg);

	const includeSource = includeFromCli ?? base.include ?? [];
	const excludeSource = excludeFromCli ?? base.exclude ?? [];

	const excludeSet = new Set(excludeSource);
	const include = includeSource.filter((name) => !excludeSet.has(name));

	return {
		include,
		exclude: excludeSource
	};
}

function warnUnknownFilterNames(
	filterName: 'include' | 'exclude',
	requested: string[] | undefined,
	availableTypeNames: string[],
): void {
	const unknown = getUnknownFilterNames(requested, availableTypeNames);
	if (unknown.length === 0) {
		return;
	}

	const availableList = availableTypeNames.length > 0
		? availableTypeNames.join(', ')
		: '(none)';
	console.warn(
		`Warning: Unknown ${filterName} type name(s): ${unknown.join(', ')}. Available types: ${availableList}`,
	);
}

export function getUnknownFilterNames(
	requested: string[] | undefined,
	availableTypeNames: string[],
): string[] {
	if (!requested || requested.length === 0) {
		return [];
	}

	const available = new Set(availableTypeNames);
	return requested.filter((name) => !available.has(name));
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function printHelp(): void {
	console.log(`
langium-zod — generate Zod schemas from Langium grammar files

USAGE
  langium-zod generate [options]

OPTIONS
  --config <path>   Path to langium-config.json  (default: langium-config.json)
  --out    <path>   Output file path              (default: <out>/zod-schemas.ts)
	--include <csv>   Comma-separated type allowlist
	--exclude <csv>   Comma-separated type blocklist
	--projection <file> Projection config JSON file
	--strip-internals  Strip internal Langium metadata fields
	--conformance     Generate conformance artifact
	--ast-types <path> Path to generated AST declarations (ast.ts)
	--conformance-out <path> Output path for conformance artifact
	--cross-ref-validation Emit runtime cross-reference schema factories
  --help            Show this help message

CONFIGURATION
  Create a langium-zod.config.js (or .mjs) in the same directory as
  langium-config.json to customise generation:

    // langium-zod.config.js
    export default {
      outputPath: 'src/generated/zod-schemas.ts',
      regexOverrides: {
        BigDecimal: String.raw\`^[+-]?(\\.[0-9]+|[0-9]+\\.[0-9]*)([eE][+-]?[0-9]+)?$\`,
      },
      include: [],  // allowlist of type names to include
      exclude: [],  // blocklist of type names to exclude
    };
`);
}

/**
 * Recursively load imported grammar files so that DocumentBuilder can link
 * cross-file references correctly (mirrors langium-cli's eagerLoad strategy).
 */
async function eagerLoad(
	document: LangiumDocument,
	documents: { getOrCreateDocument: (uri: URI) => Promise<LangiumDocument> },
	visited: Set<string> = new Set(),
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

export interface GenerateOptions {
	/** Absolute path to langium-config.json */
	langiumConfigPath: string;
	/** Merged generator config (from user's langium-zod.config.js + CLI flags) */
	config?: LangiumZodConfig;
}

export async function generate(opts: GenerateOptions): Promise<void> {
	const { langiumConfigPath } = opts;
	const userConfig: LangiumZodConfig = opts.config ?? {};

	// ── 1. Load langium-config.json ─────────────────────────────────────────
	if (!existsSync(langiumConfigPath)) {
		throw new Error(`langium-config.json not found: ${langiumConfigPath}`);
	}
	const langiumConfig: LangiumConfigJson = JSON.parse(
		readFileSync(langiumConfigPath, 'utf8'),
	);

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
	const outputPath: string =
		userConfig.outputPath ?? join(outDir, 'zod-schemas.ts');

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
		validation: false,
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
	const { langiumConfig: _ignored, outputPath: _op, ...restConfig } = userConfig;

	generateZodSchemas({
		grammar,
		outputPath,
		...restConfig,
	});

	console.log(`✓ Generated Zod schemas → ${outputPath}`);
}

// ────────────────────────────────────────────────────────────────────────────
// CLI entry point
// ────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
		printHelp();
		process.exit(0);
	}

	const command = args[0];
	if (command !== 'generate') {
		console.error(`Unknown command: ${command}`);
		printHelp();
		process.exit(1);
	}

	// ── Parse flags ──────────────────────────────────────────────────────────
	const configFlagIdx = args.indexOf('--config');
	const configFlagValue =
		configFlagIdx >= 0 ? args[configFlagIdx + 1] : undefined;
	const outFlagIdx = args.indexOf('--out');
	const outFlagValue = outFlagIdx >= 0 ? args[outFlagIdx + 1] : undefined;
	const includeFlagValue = getArgValue(args, '--include');
	const excludeFlagValue = getArgValue(args, '--exclude');
	const projectionFlagValue = getArgValue(args, '--projection');
	const astTypesFlagValue = getArgValue(args, '--ast-types');
	const conformanceOutFlagValue = getArgValue(args, '--conformance-out');
	const stripInternalsEnabled = args.includes('--strip-internals');
	const conformanceEnabled = args.includes('--conformance');
	const crossRefValidationEnabled = args.includes('--cross-ref-validation');

	// ── Locate langium-config.json ───────────────────────────────────────────
	const configFileName = configFlagValue ?? 'langium-config.json';
	const langiumConfigPath = resolve(process.cwd(), configFileName);

	// ── Load optional langium-zod.config.js ──────────────────────────────────
	const configDir = dirname(langiumConfigPath);
	let userConfig: LangiumZodConfig = {};

	for (const candidate of [
		'langium-zod.config.js',
		'langium-zod.config.mjs',
	]) {
		const candidatePath = join(configDir, candidate);
		if (existsSync(candidatePath)) {
			const mod = await import(pathToFileURL(candidatePath).href);
			userConfig = (mod.default ?? mod) as LangiumZodConfig;
			break;
		}
	}

	// CLI --out flag overrides config file outputPath
	if (outFlagValue) {
		userConfig = { ...userConfig, outputPath: resolve(process.cwd(), outFlagValue) };
	}

	const filterOverrides = resolveFilterOverrides(userConfig, includeFlagValue, excludeFlagValue);
	userConfig = {
		...userConfig,
		...filterOverrides
	};

	if (projectionFlagValue) {
		const projectionPath = resolve(process.cwd(), projectionFlagValue);
		userConfig = {
			...userConfig,
			projection: loadProjectionConfig(projectionPath)
		};
	}

	if (stripInternalsEnabled) {
		userConfig = {
			...userConfig,
			stripInternals: true
		};
	}

	if (conformanceEnabled) {
		userConfig = {
			...userConfig,
			conformance: {
				astTypesPath: astTypesFlagValue ? resolve(process.cwd(), astTypesFlagValue) : undefined,
				outputPath: conformanceOutFlagValue ? resolve(process.cwd(), conformanceOutFlagValue) : undefined
			}
		};
	}

	if (crossRefValidationEnabled) {
		userConfig = {
			...userConfig,
			crossRefValidation: true
		};
	}

	try {
		await generate({ langiumConfigPath, config: userConfig });
	} catch (err) {
		console.error('Error:', err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}

// Guard against library imports running the CLI
const isMain =
	process.argv[1] != null &&
	(process.argv[1].endsWith('/cli.js') ||
		process.argv[1].endsWith('/cli.ts') ||
		process.argv[1].endsWith('langium-zod'));

if (isMain) {
	void main();
}
