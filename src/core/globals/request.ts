import type { Context } from 'hono';

export function getClientIpFromXForwardedFor(ctx: Context) {
    const xForwardedFor = ctx.req.header('x-forwarded-for');
    if (!xForwardedFor) return;
    const firstCommaIndex = xForwardedFor.indexOf(',');
    return (firstCommaIndex === -1 ? xForwardedFor : xForwardedFor.substring(0, firstCommaIndex)).trim();
}
