import { swaggerUI } from '@hono/swagger-ui';

export default defineRouteHandlers(swaggerUI({ url: '/docs/openapi.json' }));
