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

// Functions
export function createOpenApiDocumentHandler(options?: Partial<GenerateSpecOptions>) {
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
