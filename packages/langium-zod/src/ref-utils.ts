import { z } from 'zod';

/**
 * Creates a Zod string schema that validates a cross-reference value against an
 * allowlist of known identifiers, evaluated lazily at parse time.
 *
 * This is used in generated cross-reference schema factories (emitted when
 * `crossRefValidation` is enabled in {@link ZodGeneratorConfig}) to validate that
 * a `$refText` string resolves to an identifier that actually exists in the current
 * document model. The collection is resolved lazily via a getter function so that it
 * can reference the live state of the Langium document at validation time rather than
 * a snapshot captured at schema construction.
 *
 * Empty strings and whitespace-only values always pass (they represent
 * unresolved/placeholder references). When the collection is empty or not yet
 * populated, validation also passes to avoid false negatives during incremental
 * parsing.
 *
 * @remarks
 * Generated schema factories produced by `crossRefValidation: true` call this
 * function with a getter (lambda) instead of a static array. This ensures the
 * resolved reference list reflects the document's live state at the moment of
 * validation rather than at schema creation time.
 *
 * `zRef` is exported for consumers who want to extend or wrap the generated schemas
 * with custom cross-reference validation that shares the same leniency semantics
 * (empty string passes, empty collection passes).
 *
 * @param collection - Either a static `string[]` or a zero-argument function that
 *   returns the current list of valid reference target names.
 * @param message - Custom validation error message returned when the value is not
 *   found in the collection. Defaults to `'Unknown reference value'`.
 * @returns A `z.ZodString` schema with a `.refine` constraint attached.
 *
 * @example
 * ```ts
 * import { zRef } from 'langium-zod';
 *
 * // Static allowlist
 * const schema = zRef(['Alice', 'Bob', 'Carol']);
 * schema.parse('Alice');  // ok
 * schema.parse('Dave');   // throws ZodError: Unknown reference value
 *
 * // Lazy getter — collection is resolved at parse time
 * const liveRefs: string[] = [];
 * const lazySchema = zRef(() => liveRefs);
 * liveRefs.push('Alice');
 * lazySchema.parse('Alice'); // ok — picked up the live state
 * ```
 *
 * @useWhen
 * - You need runtime cross-reference validation and are using `crossRefValidation: true`
 *   to have the generator emit `create*Schema()` factories that call `zRef`.
 * - You are extending a generated schema with custom cross-reference validation using
 *   the same empty-string leniency semantics as generated factories.
 * - You are building a Langium language server plugin that needs live document
 *   validation with lazily-resolved reference targets.
 *
 * @avoidWhen
 * - You are doing offline/batch validation with a fully-resolved document — use a plain
 *   `z.string().refine(v => knownSet.has(v))` instead which is simpler and faster.
 * - You do not need cross-reference validation at all — omit `crossRefValidation` in
 *   the config to skip generating these factories entirely.
 * - You are validating Langium's `$container` / `$document` metadata fields — those
 *   are not cross-references and should not be validated with `zRef`.
 *
 * @pitfalls
 * - NEVER pass a static snapshot of the reference array when calling `zRef` inside a
 *   Langium validator that runs repeatedly. BECAUSE the snapshot will not reflect
 *   document edits; pass a getter `() => myLiveList` instead.
 * - NEVER expect `zRef` to fail on empty strings. BECAUSE empty strings are
 *   intentionally allowed to represent unresolved/placeholder references — this matches
 *   Langium's own handling of incomplete cross-references during editing.
 * - NEVER use `zRef` as the sole cross-reference validation mechanism in a security
 *   context. BECAUSE it only checks string membership; it does not validate that the
 *   referenced object is of the correct type or that it exists in the correct scope.
 *
 * @category Generation
 * @defaultValue message `'Unknown reference value'`
 * @see {@link ZodGeneratorConfig.crossRefValidation}
 */
export function zRef(
  collection: string[] | (() => string[]),
  message = 'Unknown reference value'
): z.ZodString {
  return z.string().refine(
    (value) => {
      if (value === '' || value.trim() === '') {
        return true;
      }
      const values = typeof collection === 'function' ? collection() : collection;
      if (!Array.isArray(values) || values.length === 0) {
        return true;
      }
      return values.includes(value);
    },
    { message }
  );
}
