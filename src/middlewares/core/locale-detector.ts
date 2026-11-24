import { localeDetector } from '@kcs-project/pack/hono-backend/middlewares/locale-detector';

import { honoApp } from '@/core/app';

// Registered first so every response, including errors and 404, is localized.
honoApp.use(localeDetector());
