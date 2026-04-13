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
