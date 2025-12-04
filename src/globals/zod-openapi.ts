import type { Except } from 'type-fest';

import type { RouteZodOpenApiConfig } from '@/core/types/zod-openapi';

export function defineApiRouteZodOpenApiConfig(
    operationId: string,
    description: string,
    tags: string[],
    config: Except<RouteZodOpenApiConfig, 'description' | 'operationId' | 'tags'>,
): RouteZodOpenApiConfig {
    return {
        ...config,
        description,
        operationId,
        tags,
    };
}
