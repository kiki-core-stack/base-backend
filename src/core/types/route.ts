import type {
    Context,
    Next,
} from 'hono';
import type { DescribeRouteOptions } from 'hono-openapi';
import type { ArrayValues } from 'type-fest';
import type * as z from 'zod';

import type {
    allowedRouteHttpMethods,
    routeMetaSymbol,
} from '../constants/route';

export type RouteHandlers = unknown[] & { readonly [routeMetaSymbol]: RouteMeta };
export type RouteHttpMethod = ArrayValues<typeof allowedRouteHttpMethods>;
export type RouteMetaArgs = Partial<RouteMeta> extends RouteMeta ? [meta?: RouteMeta] : [meta: RouteMeta];
export type RouteMiddlewareHandler = (
    ctx: Context,
    route: RegisteredRoute,
    next: Next,
) => Promise<Response | void> | Response | void;

export interface RegisteredRoute extends RouteDefinition {
    meta: RouteMeta;
}

export interface RouteDefinition {
    filePath: string;
    method: RouteHttpMethod;
    path: string;
}

export interface RouteDocs extends Omit<DescribeRouteOptions, 'responses'> {
    /**
     * Response docs keyed by status code. A schema alone documents an `application/json` response.
     */
    responses?: Partial<Record<'default' | number, RouteDocsResponse | z.ZodType>>;
}

export interface RouteDocsResponse {
    /**
     * @defaultValue 'application/json'
     */
    contentType?: string;
    description?: string;
    schema?: z.ZodType;
}

/**
 * Per-route metadata passed to `defineRoute(meta)`.
 *
 * Extend it with declaration merging. Required fields added downstream make the
 * `defineRoute` argument required as well.
 */
export interface RouteMeta {
    docs?: RouteDocs;
}

export interface RouteModuleEntry extends RouteDefinition {
    module: { readonly default?: unknown };
}
