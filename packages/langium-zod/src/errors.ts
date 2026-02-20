export interface ZodGeneratorErrorOptions {
	grammarElement?: string;
	typeName?: string;
	suggestion?: string;
	cause?: unknown;
}

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
