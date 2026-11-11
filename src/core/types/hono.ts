import type { RegisteredRoute } from './route';

declare module 'hono' {
    interface ContextVariableMap {
        /**
         * Set for requests matched by a registered file route; unavailable in app-level middlewares and 404 handling.
         */
        route: RegisteredRoute;
    }
}
