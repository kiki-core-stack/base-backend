import { Hono } from 'hono';
import { createFactory } from 'hono/factory';

export const honoApp = new Hono();

export const defineRouteHandlers = createFactory().createHandlers;
