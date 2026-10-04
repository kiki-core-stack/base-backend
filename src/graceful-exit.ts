import type { Server } from 'bun';

import { redisClient } from '@kcs-project/pack/constants/redis';
import mongoose from 'mongoose';

let isGracefulExitStarted = false;

export async function gracefulExit(server?: Server<any>) {
    if (isGracefulExitStarted) return;
    isGracefulExitStarted = true;
    logger.info('Starting graceful shutdown...');
    await server?.stop();

    // Perform operations such as closing the database connection here.
    redisClient.close();
    await mongoose.disconnect();

    logger.success('Graceful shutdown completed');
    process.exit(0);
}
