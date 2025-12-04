import type { Except } from 'type-fest';

import type { allowedRouteHttpMethods } from '../constants/route';

export type RouteHttpMethod = (typeof allowedRouteHttpMethods)[number];

export interface Route {
    handlerProperties?: RouteHandlerProperties;
}

export interface RouteDefinition {
    filePath: string;
    method: RouteHttpMethod;
    openApiPath: string;
    path: string;
}

export interface RouteHandlerOptions {
    properties?: Except<RouteHandlerProperties, 'isHandler'>;
}

export interface RouteHandlerProperties {
    readonly isHandler?: true;
}
