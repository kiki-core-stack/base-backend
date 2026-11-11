import { requestId } from 'hono/request-id';

import { honoApp } from '@/core/app';

// Sets ctx.var.requestId (from X-Request-Id or generated) and echoes it in the response header.
honoApp.use(requestId());
