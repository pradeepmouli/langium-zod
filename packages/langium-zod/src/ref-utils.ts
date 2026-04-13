import { z } from 'zod';

/**
 * Creates a Zod string schema that validates a cross-reference value against an
 * allowlist of known identifiers, evaluated lazily at parse time.
 *
 * This is used in generated cross-reference schema factories (emitted when
 * `crossRefValidation` is enabled) to validate that a `$refText` string resolves
 * to an identifier that actually exists in the current document model. The
 * collection is resolved lazily via a getter function so that it can reference the
 * live state of the Langium document at validation time rather than a snapshot
 * captured at schema construction.
 *
 * Empty strings and whitespace-only values always pass (they represent
 * unresolved/placeholder references). When the collection is empty or not yet
 * populated, validation also passes to avoid false negatives during incremental
 * parsing.
 *
 * @param collection - Either a static `string[]` or a zero-argument function that
 *   returns the current list of valid reference target names.
 * @param message - Custom validation error message returned when the value is not
 *   found in the collection. Defaults to `'Unknown reference value'`.
 * @returns A `z.ZodString` schema with a `.refine` constraint attached.
 */
export function zRef(
	collection: string[] | (() => string[]),
	message = 'Unknown reference value',
): z.ZodString {
	return z.string().refine((value) => {
		if (value === '' || value.trim() === '') {
			return true;
		}
		const values = typeof collection === 'function' ? collection() : collection;
		if (!Array.isArray(values) || values.length === 0) {
			return true;
		}
		return values.includes(value);
	}, { message });
}
