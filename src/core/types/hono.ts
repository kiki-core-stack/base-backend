import type { H } from 'hono/types';

import type { RouteHandlerProperties } from './route';

declare module 'hono' {
    interface Context {
        routeHandler?: H & RouteHandlerProperties;
    }
}
