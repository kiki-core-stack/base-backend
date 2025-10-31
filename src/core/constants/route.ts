import type { ReadonlyDeep } from 'type-fest';

import type {
    Route,
    RouteHttpMethod,
} from '../types/route';

export const allowedRouteHttpMethods = [
    'delete',
    'get',
    'head',
    'options',
    'patch',
    'post',
    'put',
] as const;

export const allRoutes: ReadonlyDeep<Record<RouteHttpMethod, Record<string, Route>>> = {
    delete: {},
    get: {},
    head: {},
    options: {},
    patch: {},
    post: {},
    put: {},
};
