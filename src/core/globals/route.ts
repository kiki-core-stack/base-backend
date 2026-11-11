import type { createFactory } from 'hono/factory';

import { routeMetaSymbol } from '../constants/route';
import type {
    RouteMeta,
    RouteMetaArgs,
} from '../types/route';

type CreateHandlers = ReturnType<typeof createFactory>['createHandlers'];

// Functions
/**
 * Defines a file route: `export default defineRoute(meta)(...handlers)`.
 *
 * The second call is Hono's `createHandlers`, so middleware Env/Input types merge into the final handler.
 */
export function defineRoute(...args: RouteMetaArgs): CreateHandlers {
    // Defaults to {} only when every RouteMeta field is optional.
    const meta: Partial<RouteMeta> = args[0] ?? {};
    const createHandlers = (...handlers: unknown[]) => Object.assign(handlers, { [routeMetaSymbol]: meta });
    return createHandlers as unknown as CreateHandlers;
}
