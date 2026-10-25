import { join } from 'node:path';

import bunProductionPlugins from '@/plugins/bun/production';

import { runBuild } from '../../build';

import { projectSrcDirPath } from './constants/paths';
import { logger } from './logger';

// Generate routes before the shared build pipeline runs.
await import('./generators/routes/production');

logger.info('Starting build...');
await runBuild({
    entrypoints: [
        join(projectSrcDirPath, 'core/entrypoints/production.ts'),
        join(projectSrcDirPath, 'index.ts'),
    ],
    plugins: bunProductionPlugins,
    root: projectSrcDirPath,
    splitting: true,
});
