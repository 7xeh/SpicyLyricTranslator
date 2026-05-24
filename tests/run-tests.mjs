import { mkdtempSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';
import esbuild from 'esbuild';

const outDir = mkdtempSync(path.join(tmpdir(), 'slt-tests-'));
const entryPoints = readdirSync('tests')
    .filter(file => file.endsWith('.test.ts'))
    .map(file => path.join('tests', file));

await esbuild.build({
    entryPoints,
    outdir: outDir,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    logLevel: 'silent',
    define: {
        __VERSION__: JSON.stringify('test'),
        __DEV__: JSON.stringify(true)
    }
});

const builtTests = readdirSync(outDir)
    .filter(file => file.endsWith('.js') || file.endsWith('.cjs'))
    .map(file => path.join(outDir, file));

const result = spawnSync(process.execPath, ['--test', ...builtTests], {
    stdio: 'inherit'
});

process.exit(result.status ?? 1);
