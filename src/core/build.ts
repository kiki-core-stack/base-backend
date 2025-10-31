import { rm } from 'node:fs/promises';

import productionPlugins from '@/plugins/bun/production';

import { projectDistDirPath } from './constants/paths';
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
const buildOutput = await Bun.build({
    entrypoints: [
        './src/index.ts',
        './src/production-entrypoint.ts',
    ],
    format: 'esm',
    minify: true,
    outdir: projectDistDirPath,
    plugins: productionPlugins,
    splitting: true,
    target: 'bun',
});

if (buildOutput.success) logger.success('Build completed');
else logger.error('Build failed');
process.exit(buildOutput.success ? 0 : 1);
