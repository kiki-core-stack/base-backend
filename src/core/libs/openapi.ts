import { STATUS_CODES } from 'node:http';

import {
    openAPIRouteHandler,
    resolver,
} from 'hono-openapi';
import type {
    DescribeRouteOptions,
    GenerateSpecOptions,
} from 'hono-openapi';
import { objectEntries } from 'ts-extras';
import * as z from 'zod';

import { honoApp } from '../app';
import type {
    RouteDocs,
    RouteDocsResponse,
} from '../types/route';

type OpenApiMethod = Exclude<keyof NonNullable<GenerateSpecOptions['defaultOptions']>, 'ALL'>;

export interface OpenApiDocumentHandlerOptions extends Partial<GenerateSpecOptions> {
    /**
     * Docs applied to every documented route (`meta.docs` or a validator) of any method, e.g. an error response every
     * route can return. A route's own fields take precedence and its responses override these per status code.
     * `defaultOptions` given for a method replaces these docs for that method.
     */
    defaultDocs?: RouteDocs;
}

// Constants
// hono-openapi applies `defaultOptions` by the route's own method (`ALL` only to routes registered with `all`).
const openApiMethods: OpenApiMethod[] = [
    'DELETE',
    'GET',
    'HEAD',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
    'TRACE',
];

// Functions
export function createOpenApiDocumentHandler({ defaultDocs, ...options }: OpenApiDocumentHandlerOptions = {}) {
    if (defaultDocs) {
        const defaultDescribeRouteOptions = routeDocsToDescribeRouteOptions(defaultDocs);
        options.defaultOptions = {
            ...Object.fromEntries(openApiMethods.map((method) => [
                method,
                defaultDescribeRouteOptions,
            ])),
            ...options.defaultOptions,
        };
    }

    return openAPIRouteHandler(honoApp, options);
}

export function normalizeRouteDocsResponse(response: RouteDocsResponse | z.ZodType): RouteDocsResponse {
    return response instanceof z.ZodType ? { schema: response } : response;
}

export function routeDocsToDescribeRouteOptions({ responses, ...options }: RouteDocs): DescribeRouteOptions {
    if (!responses) return options;
    const describeRouteResponses: NonNullable<DescribeRouteOptions['responses']> = {};
    for (const [status, rawResponse] of objectEntries(responses)) {
        if (!rawResponse) continue;
        const response = normalizeRouteDocsResponse(rawResponse);
        describeRouteResponses[status] = {
            content: response.schema
                ? { [response.contentType ?? 'application/json']: { schema: resolver(response.schema) } }
                : undefined,
            description: response.description ?? STATUS_CODES[status] ?? 'Response',
        };
    }

    return {
        ...options,
        responses: describeRouteResponses,
    };
}
