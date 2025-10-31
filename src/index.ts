import type { Server } from 'bun';

import { honoApp } from '@/core/app';
import { gracefulExit } from '@/graceful-exit';

let server: Server<any> | undefined;
process.on('SIGINT', () => gracefulExit(server));
process.on('SIGTERM', () => gracefulExit(server));

// Load middlewares
await import('@/middlewares');

// Start server
logger.info('Starting server...');
server = Bun.serve({
    fetch: honoApp.fetch,
    hostname: process.env.SERVER_HOST || '127.0.0.1',
    port: Number(process.env.SERVER_PORT) || 8000,
    reusePort: true,
});

logger.success(`Server started at http://${server.hostname}:${server.port}`);
