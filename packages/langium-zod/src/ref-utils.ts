import { z } from 'zod';

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
