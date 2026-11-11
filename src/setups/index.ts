// One-time startup setups (side effects). Imported first by src/index.ts.

import '@kcs-project/pack/hono-backend/setups/mongoose-model-statics';
import './hono-context';

import { setupHonoAppErrorHandling } from '@kcs-project/pack/hono-backend/setups/error-handling';

import { honoApp } from '@/core/app';

setupHonoAppErrorHandling(honoApp, logger);
