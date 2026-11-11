import type { MiddlewareHandler } from 'hono';
import { objectEntries } from 'ts-extras';
import * as z from 'zod';

import { logger } from '../logger';
import type { RegisteredRoute } from '../types/route';

import { normalizeRouteDocsResponse } from './openapi';

// Constants
const isResponseValidationEnabled = process.env.VALIDATE_RESPONSES === 'true';

// Functions
/**
 * When `VALIDATE_RESPONSES=true`, checks JSON responses against `meta.docs.responses` schemas and logs mismatches.
 *
 * It never alters or rejects the response.
 */
export function createResponseValidationMiddleware(route: RegisteredRoute): MiddlewareHandler | undefined {
    if (!isResponseValidationEnabled || !route.meta.docs?.responses) return;
    const statusToSchemaMap = new Map<number, z.ZodType>();
    for (const [status, rawResponse] of objectEntries(route.meta.docs.responses)) {
        if (!rawResponse || !/^\d+$/.test(status)) continue;
        const response = normalizeRouteDocsResponse(rawResponse);
        if (response.schema && (response.contentType ?? 'application/json') === 'application/json') {
            statusToSchemaMap.set(+status, response.schema);
        }
    }

    if (!statusToSchemaMap.size) return;
    const logPrefix = `[Response validation] ${route.method.toUpperCase()} ${route.path}`;
    return async (ctx, next) => {
        await next();
        const schema = statusToSchemaMap.get(ctx.res.status);
        if (!schema || !ctx.res.headers.get('content-type')?.startsWith('application/json')) return;

        let body: unknown;
        try {
            body = await ctx.res.clone().json();
        } catch (error) {
            logger.warn(`${logPrefix} ${ctx.res.status}: failed to parse JSON body`, error);
            return;
        }

        const result = await schema.safeParseAsync(body);
        if (!result.success) {
            logger.warn(`${logPrefix} ${ctx.res.status}: body does not match schema\n${z.prettifyError(result.error)}`);
        }
    };
}
