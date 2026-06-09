#!/usr/bin/env node
/**
 * langium-zod CLI
 *
 * Usage:
 *   langium-zod generate [--config langium-config.json] [--out src/generated/zod-schemas.ts]
 *   langium-zod --help
 *
 * @remarks
 * This module carries the `#!` shebang and `process.argv` parsing. The programmatic
 * generation core lives in `./generate.ts` (shebang-free) so the package's main
 * entry can re-export `generate` without dragging the shebang into consumer bundle
 * graphs. The moved symbols are re-exported below for backward compatibility.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generate } from './generate.js';
import type { LangiumZodConfig } from './generate.js';
import { loadProjectionConfig } from './projection.js';

// Re-export the programmatic core for callers that import from the CLI entry.
export { generate, getUnknownFilterNames } from './generate.js';
export type { GenerateOptions, LangiumZodConfig } from './generate.js';

// ────────────────────────────────────────────────────────────────────────────
// Argument parsing helpers
// ────────────────────────────────────────────────────────────────────────────

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

/**
 * Merges CLI `--include` / `--exclude` flag values with the base filter from a
 * user config file, producing a deduplicated, conflict-free filter pair.
 *
 * CLI arguments take precedence over the config file values. Any name that appears
 * in both `include` and `exclude` is removed from `include` so that the exclude
 * list is authoritative.
 *
 * @param base - Baseline include/exclude arrays from the user's
 *   `langium-zod.config.js`, used when the corresponding CLI flag is absent.
 * @param includeArg - Raw comma-separated string from `--include`, or `undefined`
 *   when the flag was not passed.
 * @param excludeArg - Raw comma-separated string from `--exclude`, or `undefined`
 *   when the flag was not passed.
 * @returns A resolved `{ include, exclude }` pair ready to merge into the
 *   generator config.
 */
export function resolveFilterOverrides(
  base: Pick<LangiumZodConfig, 'include' | 'exclude'>,
  includeArg?: string,
  excludeArg?: string
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
	--domain          Also emit the domain surface (domain.ts)
	--domain-only     Emit ONLY the domain surface (implies --domain, skips Zod schemas)
	--domain-out <path> Output path for the domain surface
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

// ────────────────────────────────────────────────────────────────────────────
// CLI entry point
// ────────────────────────────────────────────────────────────────────────────

/**
 * CLI entry point executed when the `langium-zod` binary is invoked directly.
 *
 * Parses `process.argv`, resolves `langium-config.json`, loads an optional
 * `langium-zod.config.js` from the same directory, merges all CLI flag overrides
 * (--out, --include, --exclude, --projection, --strip-internals, --conformance,
 * --cross-ref-validation, --domain, --domain-only), then delegates to
 * {@link generate}. Exits the process with code 1 on error.
 */
export async function main(): Promise<void> {
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
  const configFlagValue = configFlagIdx >= 0 ? args[configFlagIdx + 1] : undefined;
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
  const domainOnlyEnabled = args.includes('--domain-only');
  const domainEnabled = args.includes('--domain') || domainOnlyEnabled;
  const domainOutFlagValue = getArgValue(args, '--domain-out');

  // ── Locate langium-config.json ───────────────────────────────────────────
  const configFileName = configFlagValue ?? 'langium-config.json';
  const langiumConfigPath = resolve(process.cwd(), configFileName);

  // ── Load optional langium-zod.config.js ──────────────────────────────────
  const configDir = dirname(langiumConfigPath);
  let userConfig: LangiumZodConfig = {};

  for (const candidate of ['langium-zod.config.js', 'langium-zod.config.mjs']) {
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
        outputPath: conformanceOutFlagValue
          ? resolve(process.cwd(), conformanceOutFlagValue)
          : undefined
      }
    };
  }

  if (crossRefValidationEnabled) {
    userConfig = {
      ...userConfig,
      crossRefValidation: true
    };
  }

  if (domainEnabled) {
    userConfig = {
      ...userConfig,
      emitDomain: true,
      // --domain-only emits the domain surface WITHOUT regenerating Zod schemas,
      // so a domain generate can use its own (full) projection without clobbering
      // a separately-projected zod-schemas.ts.
      domainOnly: domainOnlyEnabled,
      domainOutputPath: domainOutFlagValue
        ? resolve(process.cwd(), domainOutFlagValue)
        : userConfig.domainOutputPath
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
