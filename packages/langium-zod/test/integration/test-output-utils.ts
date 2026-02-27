import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export function createTempOutputPath(prefix: string): { dir: string; outputPath: string; cleanup: () => void } {
	const dir = join(tmpdir(), `${prefix}-${crypto.randomUUID()}`);
	const outputPath = join(dir, 'generated', 'zod-schemas.ts');
	mkdirSync(join(dir, 'generated'), { recursive: true });

	return {
		dir,
		outputPath,
		cleanup: () => rmSync(dir, { recursive: true, force: true })
	};
}
