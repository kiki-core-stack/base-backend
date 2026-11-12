import {
    createCookieSession,
    createCookieTokenHandler,
} from '@kcs-project/pack/hono-backend/libs/cookie-session';

import { honoApp } from '@/core/app';

honoApp.use(
    '/api/*',
    createCookieSession({
        keys: checkAndGetEnvValue('COOKIE_SESSION_KEYS'),
        tokenHandler: createCookieTokenHandler(),
    }),
);
