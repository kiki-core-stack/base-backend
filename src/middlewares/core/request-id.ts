import { requestId } from 'hono/request-id';

import { honoApp } from '@/core/app';

honoApp.use(requestId());
