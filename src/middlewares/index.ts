// Control the middleware registration condition and order here
if (process.env.NODE_ENV === 'development') await import('./core/logger');
await import('./core/route');
