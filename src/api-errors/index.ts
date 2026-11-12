// Pack errors are re-exported per namespace; `export * from '<package>'` breaks bundled builds (see core/build.ts).
// Add this repo's errors as their own namespaces, e.g. `export * as forum from './forum';`; `auth` and `common` are
// taken by pack. Codes must be unique across namespaces (checked at development startup).
export * as auth from '@kcs-project/pack/hono-backend/api-errors/auth';
export * as common from '@kcs-project/pack/hono-backend/api-errors/common';
