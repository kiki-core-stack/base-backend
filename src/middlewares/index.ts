// Control the middleware registration condition and order here.
//
// - honoApp.use(): app-level middlewares; run for every request, including 404.
// - useRouteMiddleware(pattern, handler): route-level middlewares; run only for matched file routes and receive the
//   route meta. They must be registered here, before routes are loaded.

if (process.env.NODE_ENV === 'development') await import('./core/logger');

await import('./context/session');

await import('./core/api');
