import { Scalar } from '@scalar/hono-api-reference';

export default defineRouteHandlers(Scalar({ url: '/docs/openapi.json' }));
