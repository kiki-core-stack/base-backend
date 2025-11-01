import { rm } from 'node:fs/promises';
import { join } from 'node:path';

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
await Bun.build({
    entrypoints: [
        join(projectSrcDirPath, 'core/entrypoints/production.ts'),
        join(projectSrcDirPath, 'index.ts'),
    ],
    minify: true,
    outdir: projectDistDirPath,
    plugins: bunProductionPlugins,
    splitting: true,
    target: 'bun',
});

logger.success('Build completed');
process.exit(0);
