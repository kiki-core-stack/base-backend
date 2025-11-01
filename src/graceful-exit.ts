import type { Server } from 'bun';

let isGracefulExitStarted = false;

export async function gracefulExit(server?: Server<any>) {
    if (isGracefulExitStarted) return;
    isGracefulExitStarted = true;
    logger.info('Starting graceful shutdown...');
    await server?.stop();

    // Perform operations such as closing the database connection here.

    logger.success('Graceful shutdown completed');
    process.exit(0);
}
