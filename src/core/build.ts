import { rm } from 'node:fs/promises';
import {
    join,
    relative,
} from 'node:path';

import prettyBytes from 'pretty-bytes';

import bunProductionPlugins from '@/plugins/bun/production';

import {
    projectDistDirPath,
    projectSrcDirPath,
} from './constants/paths';
import * as logger from './utils/logger';

logger.info('Cleaning output directory...');
await rm(
    projectDistDirPath,
    {
        force: true,
        recursive: true,
    },
);

// Generate routes
await import('./generators/routes/production');

logger.info('Starting build...');
const result = await Bun.build({
    entrypoints: [
        join(projectSrcDirPath, 'core/entrypoints/production.ts'),
        join(projectSrcDirPath, 'index.ts'),
    ],
    minify: true,
    outdir: projectDistDirPath,
    plugins: bunProductionPlugins,
    root: projectSrcDirPath,
    splitting: true,
    target: 'bun',
    throw: false,
});

if (!result.success) {
    for (const log of result.logs) logger.error(log);
    process.exit(1);
}

const outputs = result.outputs
    .map((output) => ({
        path: relative(projectDistDirPath, output.path),
        size: output.size,
    }))
    .sort((a, b) => b.size - a.size || a.path.localeCompare(b.path));

const pathWidth = Math.max(0, ...outputs.map((output) => output.path.length));
logger.info(
    [
        'Build outputs (dist/):',
        ...outputs.map((output) => `  ${output.path.padEnd(pathWidth)}  ${prettyBytes(output.size)}`),
    ].join('\n'),
);

const totalSize = outputs.reduce((total, output) => total + output.size, 0);
logger.success(`Build completed: ${outputs.length} files, ${prettyBytes(totalSize)} total`);
process.exit(0);
