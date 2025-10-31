import { createFactory } from 'hono/factory';

import type { RouteHandlerOptions } from '../types/route';

export const defineRouteHandlerOptions = (options: RouteHandlerOptions) => options;
export const defineRouteHandlers = createFactory().createHandlers;
