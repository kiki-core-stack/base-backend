import {
    cookieSession,
    createCookieTokenHandler,
} from '@kcs-project/pack/hono-backend/middlewares/cookie-session';

import { honoApp } from '@/core/app';

honoApp.use(
    '/api/*',
    cookieSession({
        keys: checkAndGetEnvValue('COOKIE_SESSION_KEYS'),
        tokenHandler: createCookieTokenHandler(),
    }),
);
