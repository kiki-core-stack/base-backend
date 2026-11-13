import { locale } from '@kcs-project/pack/hono-backend/middlewares/locale';

import { honoApp } from '@/core/app';

// Sets ctx.var.locale from Accept-Language; registered first so every response, including errors and 404, is localized.
honoApp.use(locale());
