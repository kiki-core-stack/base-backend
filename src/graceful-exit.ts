import type { Server } from 'bun';

import { withTimeout } from 'es-toolkit/promise';

// Constants/Variables
let shutdownPromise: Promise<void> | undefined;

// Functions
export const isShuttingDown = () => !!shutdownPromise;

export function gracefulExit(server?: Server<any>) {
    return shutdownPromise ??= Promise
        .resolve()
        .then(async () => {
            const timeoutController = new AbortController();
            logger.info('Starting graceful shutdown...');

            try {
                await withTimeout(
                    async () => {
                        const errors: unknown[] = [];

                        await server?.stop().catch((error) => errors.push(error));

                        // Close application-owned resources here, after requests have drained.

                        if (errors.length) throw new AggregateError(errors, 'Resource cleanup failed');
                    },
                    30 * 1000,
                    { signal: timeoutController.signal },
                );
            } finally {
                timeoutController.abort();
            }

            logger.success('Graceful shutdown completed');
        })
        .catch((error) => {
            logger.error('Graceful shutdown failed', error);
            process.exit(1);
        });
}
