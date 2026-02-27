import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { main } from '../../src/cli.js';

function withMockedArgv(argv: string[], callback: () => Promise<void> | void): Promise<void> {
	const originalArgv = [...process.argv];
	process.argv = argv;
	const result = Promise.resolve(callback());
	return result.finally(() => {
		process.argv = originalArgv;
	});
}

describe('cli main', () => {
	it('prints help and exits with 0', async () => {
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		const exitSpy = vi
			.spyOn(process, 'exit')
			.mockImplementation(((code?: string | number | null | undefined) => {
				throw new Error(`exit:${String(code ?? 0)}`);
			}) as never);

		await expect(
			withMockedArgv(['node', '/tmp/cli.ts', '--help'], async () => {
				await main();
			})
		).rejects.toThrow('exit:0');

		expect(logSpy).toHaveBeenCalled();
		exitSpy.mockRestore();
		logSpy.mockRestore();
	});

	it('fails unknown command with exit 1', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		const exitSpy = vi
			.spyOn(process, 'exit')
			.mockImplementation(((code?: string | number | null | undefined) => {
				throw new Error(`exit:${String(code ?? 0)}`);
			}) as never);

		await expect(
			withMockedArgv(['node', '/tmp/cli.ts', 'unknown-command'], async () => {
				await main();
			})
		).rejects.toThrow('exit:1');

		expect(errorSpy).toHaveBeenCalledWith('Unknown command: unknown-command');
		exitSpy.mockRestore();
		errorSpy.mockRestore();
		logSpy.mockRestore();
	});

	it('throws when a value flag is missing', async () => {
		await expect(
			withMockedArgv(['node', '/tmp/cli.ts', 'generate', '--include'], async () => {
				await main();
			})
		).rejects.toThrow('Missing value for --include');
	});

	it('runs generate command with projection/filters and writes output', async () => {
		const dir = join(tmpdir(), `langium-zod-cli-main-${crypto.randomUUID()}`);
		mkdirSync(join(dir, 'generated'), { recursive: true });

		const grammarPath = join(dir, 'simple.langium');
		const configPath = join(dir, 'langium-config.json');
		const outputPath = join(dir, 'generated', 'zod-schemas.ts');
		const astPath = join(dir, 'generated', 'ast.ts');
		const projectionPath = join(process.cwd(), 'packages/langium-zod/test/fixtures/projection.valid.json');

		writeFileSync(
			grammarPath,
			readFileSync(join(process.cwd(), 'packages/langium-zod/test/fixtures/simple.langium'), 'utf8'),
			'utf8'
		);
		writeFileSync(
			configPath,
			JSON.stringify({
				projectName: 'tmp',
				languages: [{ grammar: './simple.langium' }],
				out: 'generated'
			}),
			'utf8'
		);
		writeFileSync(astPath, 'export interface Greeting { $type: "Greeting"; name: string }\n', 'utf8');

		try {
			await withMockedArgv(
				[
					'node',
					'/tmp/cli.ts',
					'generate',
					'--config',
					configPath,
					'--out',
					outputPath,
					'--include',
					'Greeting',
					'--exclude',
					'Tag',
					'--projection',
					projectionPath,
					'--strip-internals',
					'--conformance',
					'--cross-ref-validation'
				],
				async () => {
					await main();
				}
			);

			expect(existsSync(outputPath)).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
