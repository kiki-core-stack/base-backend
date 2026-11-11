import { Scalar } from '@scalar/hono-api-reference';

export default defineRoute()(Scalar({ url: '/docs/openapi.json' }));
