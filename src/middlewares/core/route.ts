import type { Context } from 'hono';
import { matchedRoutes } from 'hono/route';

import { honoApp } from '@/core/app';

honoApp.use(
    '/api/*',
    (ctx, next) => {
        const routerRoutes = matchedRoutes(ctx);
        ctx.routeHandler = routerRoutes.at(-1)?.handler as Context['routeHandler'];
        return next();
    },
);
