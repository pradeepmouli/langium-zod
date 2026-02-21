import type { Grammar, LangiumCoreServices, Module } from 'langium';
import type { ZodGeneratorConfig } from './config.js';
import { generateZodSchemas } from './api.js';

export interface ZodSchemaGenerator {
	generate(grammar: Grammar, config?: Partial<ZodGeneratorConfig>): string;
}

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
			outputPath: config?.outputPath
		});
	}
}

export type ZodSchemaGeneratorServices = {
	shared: {
		ZodSchemaGenerator: ZodSchemaGenerator;
	};
};

export const ZodSchemaGeneratorModule = {
	shared: {
		ZodSchemaGenerator: (services: LangiumCoreServices) => new DefaultZodSchemaGenerator(services)
	}
} as unknown as Module<ZodSchemaGeneratorServices, Partial<ZodSchemaGeneratorServices>>;
