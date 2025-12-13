import { glob } from 'node:fs/promises';

import type { WritableDeep } from 'type-fest';

import { honoApp } from '../app';
import { routesDirPath } from '../constants/paths';
import {
    allowedRouteHttpMethods,
    allRoutes,
} from '../constants/route';
import type {
    RouteDefinition,
    RouteHandlerOptions,
    RouteHttpMethod,
} from '../types/route';
import type { RouteZodOpenApiConfig } from '../types/zod-openapi';

// Functions
export const normalizeRouteHandlers = (handlers: any) => [handlers].flat().filter((handler) => handler !== undefined);

export async function discoverRouteDefinitions() {
    const envSuffix = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
    const filePattern = new RegExp(
        `^${routesDirPath}(.*?)(/index)?\\.(${allowedRouteHttpMethods.join('|')})(\\.${envSuffix})?\\.(mj|t)s$`,
    );

    const routeDefinitions: RouteDefinition[] = [];
    for await (const filePath of glob(`${routesDirPath}/**/*.{mj,t}s`, {})) {
        const matches = filePath.match(filePattern);
        if (!matches) continue;
        const normalizedRoutePath = matches[1]!.replaceAll(/\/+/g, '/') || '/';
        routeDefinitions.push({
            filePath,
            method: matches[3] as typeof allowedRouteHttpMethods[number],
            openApiPath: normalizedRoutePath.replaceAll(/\[([^/]+)\]/g, '{$1}'),
            path: normalizedRoutePath.replaceAll(/\[([^/]+)\]/g, ':$1'),
        });
    }

    return routeDefinitions.sort((a, b) => filePathToRank(a.path) - filePathToRank(b.path));
}

function filePathSegmentToRankValue(segment: string, isLast: boolean) {
    if (segment === '*' && isLast) return 1e12;
    if (segment === '*') return 1e10;
    if (segment.startsWith(':') && segment.includes('.')) return 11;
    if (segment.startsWith(':')) return 111;
    return 1;
}

function filePathToRank(path: string) {
    const segments = path.split('/');
    return +segments.map((segment, i) => filePathSegmentToRankValue(segment, i === segments.length - 1)).join('');
}

export async function registerRoute(
    method: RouteHttpMethod,
    path: string,
    handlers: any[],
    handlerOptions?: RouteHandlerOptions,
    zodOpenApiOptions?: { config: RouteZodOpenApiConfig; path: string },
) {
    const latestHandler = handlers[handlers.length - 1];

    Object.defineProperty(
        latestHandler,
        'isHandler',
        {
            configurable: false,
            value: true,
            writable: false,
        },
    );

    Object.assign(latestHandler, handlerOptions?.properties);

    honoApp.on(method, [path], ...handlers);
    (allRoutes as WritableDeep<typeof allRoutes>)[method][path] = { handlerProperties: handlerOptions?.properties };

    if (process.env.NODE_ENV === 'development' && zodOpenApiOptions) {
        const { zodOpenApiRegistry } = await import('../constants/zod-openapi');
        zodOpenApiRegistry.registerPath({
            ...zodOpenApiOptions.config,
            method,
            path: zodOpenApiOptions.path,
        });
    }
}
