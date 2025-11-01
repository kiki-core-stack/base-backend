import { logger as honoLogger } from 'hono/logger';

import { honoApp } from '@/core/app';

honoApp.use(
    honoLogger((text) => {
        if (text[0] !== '<') logger.info(text.substring(4));
    }),
);
