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
import type { ZodGeneratorConfig } from './config.js';
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
	languages?: Array<{ grammar: string }>;
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
