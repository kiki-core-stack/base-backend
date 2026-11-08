import { join } from 'node:path';

import bunProductionPlugins from '@/plugins/bun/production';

import { runBuild } from '../../build';

import * as corePaths from './constants/paths';
import { logger } from './logger';

// Generate routes before the shared build pipeline runs.
await import('./generators/routes/production');

logger.info('Starting build...');
await runBuild({
    entrypoints: [
        join(corePaths.projectSrcDir, 'core/entrypoints/production.ts'),
        join(corePaths.projectSrcDir, 'index.ts'),
    ],
    plugins: bunProductionPlugins,
    root: corePaths.projectSrcDir,
    splitting: true,
});
