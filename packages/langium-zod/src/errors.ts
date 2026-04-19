export interface ZodGeneratorErrorOptions {
  grammarElement?: string;
  typeName?: string;
  suggestion?: string;
  cause?: unknown;
}

/**
 * Custom error class thrown by the langium-zod code generator when it
 * encounters a condition it cannot recover from.
 *
 * Carries optional structured context that pinpoints the source of the problem:
 * - `typeName` — the Langium interface or union type being processed when the
 *   error occurred.
 * - `grammarElement` — the specific grammar property or rule element that
 *   triggered the failure.
 * - `suggestion` — a human-readable hint explaining how to fix the issue,
 *   surfaced to the user in CLI output.
 *
 * The `name` property is always set to `'ZodGeneratorError'` so that error
 * handlers can distinguish this class from generic `Error` instances without
 * needing an `instanceof` check across module boundaries.
 *
 * @remarks
 * `ZodGeneratorError` is the only error class thrown by the public API. Standard
 * `Error` (or subtypes) can still propagate from Langium internals (e.g. grammar
 * parse failures), but those are not wrapped.
 *
 * The `name` check (`error.name === 'ZodGeneratorError'`) is safe across module
 * boundaries where `instanceof` may fail when multiple copies of the package are
 * bundled. Always prefer `error.name` over `error instanceof ZodGeneratorError` in
 * plugin host environments.
 *
 * @example
 * ```ts
 * import { generateZodSchemas, ZodGeneratorError } from 'langium-zod';
 *
 * try {
 *   generateZodSchemas({ grammar: parsedGrammar });
 * } catch (err) {
 *   if (err instanceof ZodGeneratorError) {
 *     console.error(err.message);
 *     if (err.suggestion) console.error('Hint:', err.suggestion);
 *     if (err.typeName) console.error('Type:', err.typeName);
 *   } else {
 *     throw err;
 *   }
 * }
 * ```
 *
 * @useWhen
 * - You are wrapping {@link generateZodSchemas} in a try/catch and want to surface
 *   actionable error messages to the user.
 * - You are building a Vite/webpack plugin and need to map generation failures to
 *   build-time warnings.
 *
 * @avoidWhen
 * - You do not need structured context — a plain `Error.message` check is sufficient
 *   for simple pipelines.
 *
 * @pitfalls
 * - NEVER use `instanceof ZodGeneratorError` in a plugin host that bundles its own
 *   copy of langium-zod. BECAUSE `instanceof` fails across module boundaries when
 *   multiple instances of the class exist; use `error.name === 'ZodGeneratorError'`
 *   instead.
 *
 * @category Generation
 * @see {@link generateZodSchemas}
 */
export class ZodGeneratorError extends Error {
  readonly grammarElement?: string;
  readonly typeName?: string;
  readonly suggestion?: string;

  constructor(message: string, options?: ZodGeneratorErrorOptions) {
    super(message);
    this.name = 'ZodGeneratorError';
    this.grammarElement = options?.grammarElement;
    this.typeName = options?.typeName;
    this.suggestion = options?.suggestion;

    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}
