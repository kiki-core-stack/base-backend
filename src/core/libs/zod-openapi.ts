import {
    OpenApiGeneratorV31,
    OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';
import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import { getEnumNumberValues } from '@kikiutils/shared/enum';
import type { SchemaObject } from 'openapi3-ts/oas31';
import type { Except } from 'type-fest';
import * as z from 'zod/v4';
import type { core } from 'zod/v4';

export type RouteZodOpenApiConfig = Except<RouteConfig, 'method' | 'path'>;

export const defineRouteZodOpenApiConfig = (config: RouteZodOpenApiConfig): RouteZodOpenApiConfig => config;

export function numberEnumToZodOpenApiSchema<T extends core.util.EnumLike>(
    enumName: string,
    enumObject: T,
    toTextMap?: Record<number | string, string>,
) {
    const baseSchema = z.enum(enumObject);
    const schema = z.preprocess(
        (value) => typeof value === 'number' || typeof value === 'string' ? +value : value,
        baseSchema,
    );

    // Remove it if you need OpenAPI metadata in production
    if (process.env.NODE_ENV === 'production') return schema;
    return schema.openapi(
        enumName,
        {
            'x-enum-descriptions': toTextMap
                ? getEnumNumberValues(enumObject).map((key: number) => toTextMap[key])
                : undefined,
            'x-enum-varnames': Object.keys(enumObject).filter((key) => !Number.isFinite(+key)),
        },
    );
}

export function zodSchemaToOpenApiSchema(schema: ReturnType<(typeof z)['object']>, description?: string): SchemaObject {
    const registry = new OpenAPIRegistry();
    registry.register('schema', schema);
    return {
        ...new OpenApiGeneratorV31(registry.definitions)
            .generateComponents()
            .components!
            .schemas!
            .schema,
        description,
    };
}
