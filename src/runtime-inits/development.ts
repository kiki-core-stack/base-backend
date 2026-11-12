import { listApiErrorCodes } from '@kcs-project/pack/hono-backend/libs/api/error';

import * as apiErrors from '@/api-errors';

// Fail fast on duplicate API error codes (throws); clients only see the code.
listApiErrorCodes(apiErrors);
