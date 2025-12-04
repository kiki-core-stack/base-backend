import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import type { Except } from 'type-fest';

export type RouteZodOpenApiConfig = Except<RouteConfig, 'method' | 'path'>;
