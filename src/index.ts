import type { Server } from 'bun';
import { writeSync } from 'node:fs';
import { inspect } from 'node:util';

import { honoApp } from '@/core/app';
import {
    gracefulExit,
    isShuttingDown,
} from '@/graceful-exit';

// Constants/Variables
let server: Server<any> | undefined;

// Functions
function handleFatalError(error: unknown) {
    try {
        writeSync(process.stderr.fd, `Service failed: ${inspect(error)}\n`);
    } finally {
        process.exit(1);
    }
}

// Register events and signals
process.once('SIGINT', () => gracefulExit(server));
process.once('SIGTERM', () => gracefulExit(server));
process.once('SIGUSR2', () => gracefulExit(server));
process.once('uncaughtException', handleFatalError);
process.once('unhandledRejection', handleFatalError);

// Start

// Import environment-specific runtime initializers.
// Used for applying side effects like dev-only tooling, schema extensions, etc.
await import(`@/runtime-inits/${process.env.NODE_ENV}`);

// Load middlewares
await import('@/middlewares');

// Load routes
await import(`@/core/loaders/routes/${process.env.NODE_ENV}`);

// Do not open a listener if a signal arrived while startup imports were pending.
if (!isShuttingDown()) {
    // Start server
    logger.info('Starting server...');
    server = Bun.serve({
        fetch: honoApp.fetch,
        hostname: process.env.SERVER_HOST || '127.0.0.1',
        port: Number(process.env.SERVER_PORT) || 8080,
        reusePort: true,
    });

    logger.success(`Server started at http://${server.hostname}:${server.port}`);
}
