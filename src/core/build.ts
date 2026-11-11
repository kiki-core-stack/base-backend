import bunProductionPlugins from '@/plugins/bun/production';

import { runBuild } from '../../build';

import * as corePaths from './constants/paths';
import { logger } from './logger';

// Generate routes before the shared build pipeline runs.
await import('./generators/routes/production');

logger.info('Starting build...');

// Bun bug (still present in 1.4.4): a bundled module containing `export * from '<external module>'`
// produces undefined bindings (ReferenceError at startup), however it is imported.
// Dev is unaffected because it does not bundle. In bundled code, re-export external modules by name
// (`export { a } from 'pkg'`) or as a namespace (`export * as ns from 'pkg'`) instead.
await runBuild({
    entrypoints: [
        corePaths.projectSrcDir.join('core/entrypoints/production.ts').value,
        corePaths.projectSrcDir.join('index.ts').value,
    ],
    plugins: bunProductionPlugins,
    root: corePaths.projectSrcDir.value,
    splitting: true,
});
