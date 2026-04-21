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
 *
 * @remarks
 * Using this interface rather than calling {@link generateZodSchemas} directly
 * makes it easy to swap or mock the generator in tests without changing the call
 * sites, since the DI container injects the service automatically.
 *
 * @example
 * ```ts
 * import { inject } from 'langium';
 * import { createLangiumGrammarServices } from 'langium/grammar';
 * import { NodeFileSystem } from 'langium/node';
 * import { ZodSchemaGeneratorModule } from 'langium-zod';
 *
 * const services = inject(
 *   createLangiumGrammarServices(NodeFileSystem),
 *   ZodSchemaGeneratorModule
 * );
 * const source = services.shared.ZodSchemaGenerator.generate(grammar);
 * ```
 *
 * @useWhen
 * - You are integrating langium-zod into an existing Langium DI container and want
 *   the generator to be treated as a shared service alongside other Langium services.
 * - You need to mock or replace the generator in tests via DI overrides.
 *
 * @avoidWhen
 * - You are doing a one-off generation outside of the Langium DI lifecycle — call
 *   {@link generateZodSchemas} directly instead.
 *
 * @category DI
 * @see {@link DefaultZodSchemaGenerator}
 * @see {@link ZodSchemaGeneratorModule}
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
 *
 * @remarks
 * This class does not add logic beyond forwarding to {@link generateZodSchemas};
 * it exists to make the generator accessible as a Langium shared service. If you
 * need custom generation logic, extend this class or implement {@link ZodSchemaGenerator}
 * from scratch and register your implementation in place of {@link ZodSchemaGeneratorModule}.
 *
 * Only `include`, `exclude`, `outputPath`, and `regexOverrides` are forwarded from
 * the optional `config` parameter — other {@link ZodGeneratorConfig} fields (e.g.
 * `projection`, `conformance`, `formMetadata`) must be handled by callers that use
 * {@link generateZodSchemas} directly.
 *
 * @useWhen
 * - You are using the Langium DI lifecycle and want the default generation behaviour
 *   accessible as `services.shared.ZodSchemaGenerator`.
 * - You want to extend or override the generator within the DI system.
 *
 * @avoidWhen
 * - You need the full {@link ZodGeneratorConfig} surface (projection, conformance,
 *   formMetadata, etc.) — use {@link generateZodSchemas} directly.
 *
 * @never
 * - NEVER call `new DefaultZodSchemaGenerator(services)` manually in production code
 *   if you are already using the DI container. BECAUSE the container may inject a
 *   different instance (e.g. a mock), and constructing a second instance bypasses DI
 *   overrides set up for tests.
 *
 * @category DI
 * @see {@link ZodSchemaGenerator}
 * @see {@link ZodSchemaGeneratorModule}
 * @see {@link generateZodSchemas}
 */
export class DefaultZodSchemaGenerator implements ZodSchemaGenerator {
  #services: LangiumCoreServices;

  constructor(services: LangiumCoreServices) {
    this.#services = services;
  }

  /**
   * Generates Zod schemas for the given grammar and returns the TypeScript source string.
   *
   * @param grammar - Parsed Langium `Grammar` AST to generate schemas from.
   * @param config - Optional subset of {@link ZodGeneratorConfig}; only `include`,
   *   `exclude`, `outputPath`, and `regexOverrides` are forwarded. Use
   *   {@link generateZodSchemas} directly for the full config surface.
   * @returns The generated TypeScript source containing all Zod schema exports.
   */
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
 *
 * @remarks
 * Pass this type as a generic parameter to Langium's `inject()` or module utilities
 * if you need to type-check that your service container exposes `ZodSchemaGenerator`
 * as a shared service.
 *
 * @category DI
 * @see {@link ZodSchemaGeneratorModule}
 * @see {@link ZodSchemaGenerator}
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
 * Zod schema generator available as a shared service.
 *
 * @remarks
 * The module uses a factory function `(services) => new DefaultZodSchemaGenerator(services)`
 * so that the generator receives the same `LangiumCoreServices` instance as the rest
 * of the container. This means you can use the injected grammar services (e.g. the
 * document builder, workspace manager) from the same container without creating a
 * separate services instance.
 *
 * @example
 * ```ts
 * import { inject } from 'langium';
 * import { createLangiumGrammarServices } from 'langium/grammar';
 * import { NodeFileSystem } from 'langium/node';
 * import { ZodSchemaGeneratorModule } from 'langium-zod';
 *
 * const services = inject(
 *   createLangiumGrammarServices(NodeFileSystem),
 *   ZodSchemaGeneratorModule
 * );
 * const source = services.shared.ZodSchemaGenerator.generate(grammar);
 * ```
 *
 * @useWhen
 * - You are building a Langium language service or LSP plugin and want Zod generation
 *   available via the standard shared-service pattern.
 * - You need the generator to share the same `LangiumCoreServices` instance (e.g.
 *   document builder, URI resolution) as the rest of the language services.
 *
 * @avoidWhen
 * - You do not use Langium's DI container at all — call {@link generateZodSchemas}
 *   directly instead.
 * - You need the full {@link ZodGeneratorConfig} surface — the `generate()` method
 *   exposed by this module only forwards a subset of config fields.
 *
 * @never
 * - NEVER spread `ZodSchemaGeneratorModule` into a plain object literal and pass it
 *   to `inject()` without the correct TypeScript generic — BECAUSE the `as unknown as
 *   Module<...>` cast inside the constant means TypeScript will not catch shape
 *   mismatches if you destructure it.
 *
 * @category DI
 * @see {@link DefaultZodSchemaGenerator}
 * @see {@link ZodSchemaGeneratorServices}
 * @see {@link ZodSchemaGenerator}
 */
export const ZodSchemaGeneratorModule = {
  shared: {
    ZodSchemaGenerator: (services: LangiumCoreServices) => new DefaultZodSchemaGenerator(services)
  }
} as unknown as Module<ZodSchemaGeneratorServices, Partial<ZodSchemaGeneratorServices>>;
