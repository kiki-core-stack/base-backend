import { statusCodeToApiResponseErrorCodeMap } from '@kiki-core-stack/pack/hono-backend/constants/response';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Except } from 'type-fest';
import type { ZodObject } from 'zod';

import type { RouteZodOpenApiConfig } from '@/core/types/zod-openapi';

export function defineApiRouteZodOpenApiConfig(
    operationId: string,
    description: string,
    tags: string | string[],
    config: Except<RouteZodOpenApiConfig, 'description' | 'operationId' | 'tags'>,
): RouteZodOpenApiConfig {
    return {
        ...config,
        description,
        operationId,
        tags: Array.isArray(tags) ? tags : [tags],
    };
}

export function defineApiRouteZodOpenApiResponseConfig(
    dataSchema?: ZodObject,
    errorCodeOrStatusCode?: ContentfulStatusCode | string,
    description?: string,
) {
    let schema = z.object({
        message: z.string().optional(),
        success: z.literal(errorCodeOrStatusCode === undefined),
    });

    if (dataSchema) schema = schema.extend({ data: dataSchema });
    if (errorCodeOrStatusCode !== undefined) {
        schema = schema.extend({
            errorCode: z.literal(
                typeof errorCodeOrStatusCode === 'number'
                    ? statusCodeToApiResponseErrorCodeMap[errorCodeOrStatusCode]
                    : errorCodeOrStatusCode,
            ),
        });
    }

    return {
        content: { 'application/json': { schema } },
        description: description ?? (errorCodeOrStatusCode ? '錯誤' : '成功'),
    };
}
