import { readFileSync } from 'node:fs';
import type { ZodTypeDescriptor } from './types.js';

export interface ProjectionConfig {
	defaults?: { strip?: string[] };
	types?: Record<string, { fields?: string[] }>;
}

export interface ProjectionTransformOptions {
	projection?: ProjectionConfig;
	stripInternals?: boolean;
	warn?: (message: string) => void;
}

export const INTERNAL_METADATA_FIELDS = [
	'$container',
	'$containerProperty',
	'$containerIndex',
	'$document',
	'$cstNode'
] as const;

function normalizeStringArray(values: unknown): string[] {
	if (!Array.isArray(values)) {
		return [];
	}

	const seen = new Set<string>();
	const normalized: string[] = [];
	for (const value of values) {
		if (typeof value !== 'string') {
			continue;
		}
		const entry = value.trim();
		if (!entry || seen.has(entry)) {
			continue;
		}
		seen.add(entry);
		normalized.push(entry);
	}

	return normalized;
}

export function parseProjectionConfig(value: unknown): ProjectionConfig {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Invalid projection config: expected a JSON object at root');
	}

	const source = value as {
		defaults?: { strip?: unknown };
		types?: Record<string, { fields?: unknown }>;
	};

	const defaults = source.defaults && typeof source.defaults === 'object'
		? { strip: normalizeStringArray(source.defaults.strip) }
		: undefined;

	const types: Record<string, { fields?: string[] }> = {};
	if (source.types && typeof source.types === 'object' && !Array.isArray(source.types)) {
		for (const [typeName, rule] of Object.entries(source.types)) {
			if (!rule || typeof rule !== 'object') {
				continue;
			}
			types[typeName] = {
				fields: normalizeStringArray((rule as { fields?: unknown }).fields)
			};
		}
	}

	return {
		defaults,
		types
	};
}

export function loadProjectionConfig(projectionPath: string): ProjectionConfig {
	const content = readFileSync(projectionPath, 'utf8');
	const parsed = JSON.parse(content) as unknown;
	return parseProjectionConfig(parsed);
}

export function resolveEffectiveStripFields(options: ProjectionTransformOptions): string[] {
	const stripFields = new Set<string>();
	if (options.stripInternals) {
		for (const field of INTERNAL_METADATA_FIELDS) {
			stripFields.add(field);
		}
	}

	for (const field of options.projection?.defaults?.strip ?? []) {
		stripFields.add(field);
	}

	return Array.from(stripFields);
}

export function applyProjectionToDescriptors(
	descriptors: ZodTypeDescriptor[],
	options: ProjectionTransformOptions,
): ZodTypeDescriptor[] {
	const projection = options.projection;
	const warn = options.warn ?? ((message: string) => console.warn(message));
	const stripFields = new Set(resolveEffectiveStripFields(options));

	if (stripFields.size === 0 && !projection?.types) {
		return descriptors;
	}

	return descriptors.map((descriptor) => {
		if (descriptor.kind !== 'object') {
			return descriptor;
		}

		const originalProperties = descriptor.properties;
		const knownFields = new Set(originalProperties.map((property) => property.name));
		let properties = originalProperties.filter((property) => {
			if (property.name === '$type') {
				return true;
			}
			return !stripFields.has(property.name);
		});

		const typeRule = projection?.types?.[descriptor.name];
		const selectedFields = typeRule?.fields;
		if (Array.isArray(selectedFields)) {
			const unknownFields = selectedFields.filter((field) => !knownFields.has(field));
			if (unknownFields.length > 0) {
				warn(
					`Warning: Unknown projection field(s) for ${descriptor.name}: ${unknownFields.join(', ')}.`,
				);
			}

			const allowed = new Set(['$type', ...selectedFields]);
			properties = properties.filter((property) => allowed.has(property.name));
		}

		return {
			...descriptor,
			properties
		};
	});
}
