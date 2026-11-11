import { createApiSuccessResponseData } from '@kcs-project/pack/hono-backend/libs/api';
import { Context } from 'hono';

declare module 'hono' {
    interface Context {
        createApiSuccessResponse: <D extends object | undefined = undefined>(data?: D, message?: string) => Response;
    }
}

// Defined once on the prototype, so every route context has it without a per-request middleware.
Context.prototype.createApiSuccessResponse = function (data, message) {
    return this.json(createApiSuccessResponseData(data, message));
};
