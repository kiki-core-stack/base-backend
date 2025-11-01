import { createApiSuccessResponseData } from '@kiki-core-stack/pack/hono-backend/libs/api';
import type { Context } from 'hono';

import { honoApp } from '@/core/app';

declare module 'hono' {
    interface Context {
        createApiSuccessResponse: <D extends object | undefined = undefined>(data?: D, message?: string) => Response;
    }
}

function createApiSuccessResponse<D extends object | undefined = undefined>(this: Context, data?: D, message?: string) {
    return this.json(createApiSuccessResponseData(data, message));
}

honoApp.use(
    '/api/*',
    (ctx, next) => {
        ctx.createApiSuccessResponse = createApiSuccessResponse.bind(ctx);
        return next();
    },
);
