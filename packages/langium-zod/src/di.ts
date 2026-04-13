import type { Grammar, LangiumCoreServices, Module } from 'langium';
import type { ZodGeneratorConfig } from './config.js';
import { generateZodSchemas } from './api.js';

/**
 * Service interface for generating Zod schemas from a parsed Langium grammar.
 *
 * Implemented by {@link DefaultZodSchemaGenerator} and registered in the Langium
 * dependency-injection container via {@link ZodSchemaGeneratorModule}. Consumers
 * that obtain Langium services through the standard DI mechanism can retrieve this
 * service from `services.shared.ZodSchemaGenerator`.
 */
export interface ZodSchemaGenerator {
	generate(grammar: Grammar, config?: Partial<ZodGeneratorConfig>): string;
}

/**
 * Default implementation of {@link ZodSchemaGenerator}.
 *
 * Wraps the top-level {@link generateZodSchemas} function and injects the
 * `LangiumCoreServices` instance provided by the DI container, so callers do not
 * need to pass services manually on every invocation.
 */
export class DefaultZodSchemaGenerator implements ZodSchemaGenerator {
	#services: LangiumCoreServices;

	constructor(services: LangiumCoreServices) {
		this.#services = services;
	}

	generate(grammar: Grammar, config?: Partial<ZodGeneratorConfig>): string {
		return generateZodSchemas({
			grammar,
			services: this.#services,
			include: config?.include,
			exclude: config?.exclude,
			outputPath: config?.outputPath,
			regexOverrides: config?.regexOverrides
		});
	}
}

/**
 * Langium DI service container shape for the langium-zod extension.
 *
 * Declares the `shared.ZodSchemaGenerator` slot so that TypeScript can type-check
 * service access and module contributions without requiring a full Langium service
 * registry at compile time.
 */
export type ZodSchemaGeneratorServices = {
	shared: {
		ZodSchemaGenerator: ZodSchemaGenerator;
	};
};

/**
 * Langium `Module` definition that registers {@link DefaultZodSchemaGenerator}
 * under `shared.ZodSchemaGenerator` in the Langium DI container.
 *
 * Pass this module to `inject()` alongside your language's own module to make the
 * Zod schema generator available as a shared service:
 *
 * ```ts
 * const services = inject(createLangiumGrammarServices(NodeFileSystem), ZodSchemaGeneratorModule);
 * const source = services.shared.ZodSchemaGenerator.generate(grammar);
 * ```
 */
export const ZodSchemaGeneratorModule = {
	shared: {
		ZodSchemaGenerator: (services: LangiumCoreServices) => new DefaultZodSchemaGenerator(services)
	}
} as unknown as Module<ZodSchemaGeneratorServices, Partial<ZodSchemaGeneratorServices>>;
