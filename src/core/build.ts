import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import productionPlugins from '@/plugins/bun/production';

import {
    projectDistDirPath,
    projectSrcDirPath,
} from './constants/paths';
import { logger } from './globals/logger';

logger.info('Cleaning output directory...');
await rm(
    projectDistDirPath,
    {
        force: true,
        recursive: true,
    },
);

// await import('./production-loader-generators/routes');

logger.info('Starting build...');
await Bun.build({
    entrypoints: [
        join(projectSrcDirPath, 'index.ts'),
        join(projectSrcDirPath, 'production-entrypoint.ts'),
    ],
    minify: true,
    outdir: projectDistDirPath,
    plugins: productionPlugins,
    splitting: true,
    target: 'bun',
});

logger.success('Build completed');
process.exit(0);
