import { listApiErrorCodes } from '@kcs-project/pack/hono-backend/libs/api/error';

// Development only: frontends generate their error code types from this list.
export default defineRoute()((ctx) => ctx.createApiSuccessResponse({ codes: listApiErrorCodes(apiErrors) }));
