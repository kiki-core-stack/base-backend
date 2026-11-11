import { swaggerUI } from '@hono/swagger-ui';

export default defineRoute()(swaggerUI({ url: '/docs/openapi.json' }));
