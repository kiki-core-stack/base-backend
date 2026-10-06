import { createReplayProtectionMiddleware } from '@kcs-project/pack/hono-backend/middlewares/replay-protection';

import { honoApp } from '@/core/app';

honoApp.use(
    '/api/*',
    createReplayProtectionMiddleware(
        (ctx) => !!ctx.routeHandler?.isHandler && !ctx.routeHandler.disableReplayProtection,
    ),
);
