import { rm } from 'node:fs/promises';

import {
    projectDistDirPath,
    projectRoot,
} from './constants/paths';
import { logger } from './utils/logger';

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
const subprocess = Bun.spawn({
    cmd: [
        'bun',
        '--env-file=./.env.production.local',
        'build',
        './src/index.ts',
        './src/production-entrypoint.ts',
        '--minify',
        '--outdir=./dist',
        '--production',
        '--splitting',
        '--target=bun',
    ],
    cwd: projectRoot,
    env: {
        ...process.env,
        NODE_ENV: 'production',
    },
    stdio: [
        'ignore',
        'inherit',
        'inherit',
    ],
});

const exitCode = await subprocess.exited;
if (exitCode === 0) logger.success('Build completed');
else logger.error('Build failed');
process.exit(exitCode);
