import type { MiddlewareHandler } from 'hono';
import { describeRoute } from 'hono-openapi';

import { honoApp } from '../../app';
import { routeMetaSymbol } from '../../constants/route';
import type {
    RegisteredRoute,
    RouteHandlers,
    RouteMiddlewareHandler,
    RouteModuleEntry,
} from '../../types/route';
import { routeDocsToDescribeRouteOptions } from '../openapi';
import { createResponseValidationMiddleware } from '../response-validation';

interface RouteMiddleware {
    handler: RouteMiddlewareHandler;
    pattern: string;
}

// Constants/Variables
let isRouteRegistrationStarted = false;
const routeKeyToFilePathMap = new Map<string, string>();
const registeredRoutes: RegisteredRoute[] = [];
const routeMiddlewares: RouteMiddleware[] = [];

// Functions
export const getRegisteredRoutes = (): readonly RegisteredRoute[] => registeredRoutes;
const isRouteHandlers = (value: unknown): value is RouteHandlers => Array.isArray(value) && routeMetaSymbol in value;

function matchesRoutePattern(pattern: string, path: string) {
    if (!pattern.endsWith('/*')) return pattern === path;
    const prefix = pattern.slice(0, -2);
    return path === prefix || path.startsWith(`${prefix}/`);
}

export function registerRoute(entry: RouteModuleEntry) {
    isRouteRegistrationStarted = true;
    const handlers = entry.module.default;
    if (!isRouteHandlers(handlers)) {
        throw new Error(`Route at ${entry.filePath} must default export the result of defineRoute(...)(...)`);
    }

    const routeKey = `${entry.method.toUpperCase()} ${entry.path}`;
    const registeredFilePath = routeKeyToFilePathMap.get(routeKey);
    if (registeredFilePath) throw new Error(`Duplicate route ${routeKey} at ${entry.filePath}, already registered by ${registeredFilePath}`);

    const route: RegisteredRoute = {
        filePath: entry.filePath,
        meta: handlers[routeMetaSymbol],
        method: entry.method,
        path: entry.path,
    };

    const chain: MiddlewareHandler[] = [
        async (ctx, next) => {
            ctx.set('route', route);
            await next();
        },
    ];

    for (const routeMiddleware of routeMiddlewares) {
        if (!matchesRoutePattern(routeMiddleware.pattern, route.path)) continue;
        chain.push(async (ctx, next) => await routeMiddleware.handler(ctx, route, next));
    }

    if (route.meta.docs) chain.push(describeRoute(routeDocsToDescribeRouteOptions(route.meta.docs)));
    const responseValidationMiddleware = createResponseValidationMiddleware(route);
    if (responseValidationMiddleware) chain.push(responseValidationMiddleware);

    honoApp.on(route.method, [route.path], ...chain, ...handlers as MiddlewareHandler[]);
    routeKeyToFilePathMap.set(routeKey, entry.filePath);
    registeredRoutes.push(route);
}

export function registerRoutes(entries: RouteModuleEntry[]) {
    for (const entry of entries) registerRoute(entry);
}

/**
 * Registers a middleware for every file route whose path matches `pattern`.
 *
 * Matching runs once at registration, so it only applies to routes registered afterwards.
 * `pattern` is either an exact route path (`/api/foo/:id`) or a prefix ending with `/*` (`/api/*`).
 */
export function useRouteMiddleware(pattern: string, handler: RouteMiddlewareHandler) {
    if (isRouteRegistrationStarted) throw new Error('Route middlewares must be registered before routes are loaded');
    if (!pattern.startsWith('/') || pattern.slice(0, -1).includes('*')) {
        throw new Error(`Invalid route middleware pattern: ${pattern}`);
    }

    routeMiddlewares.push({
        handler,
        pattern,
    });
}
