import type { Server } from 'bun';
import {
    BlockList,
    isIP,
} from 'node:net';

import type { Context } from 'hono';

// Constants
const namedSubnets: Record<string, string[]> = {
    linklocal: [
        '169.254.0.0/16',
        'fe80::/10',
    ],
    loopback: [
        '127.0.0.0/8',
        '::1/128',
    ],
    uniquelocal: [
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
        'fc00::/7',
    ],
};

const trustedProxies = createTrustedProxies(process.env.SERVER_TRUSTED_PROXIES ?? 'loopback,linklocal,uniquelocal');

// Functions
function createTrustedProxies(value: string) {
    const blockList = new BlockList();
    for (const entry of value.split(',').map((entry) => entry.trim()).filter(Boolean)) {
        for (const subnet of namedSubnets[entry] ?? [entry]) {
            const [address = '', prefix] = subnet.split('/');
            const family = isIP(address);
            if (!family || (prefix !== undefined && !/^\d+$/.test(prefix))) {
                throw new Error(`Invalid SERVER_TRUSTED_PROXIES entry: ${entry}`);
            }

            const type = family === 6 ? 'ipv6' : 'ipv4';
            if (prefix === undefined) blockList.addAddress(address, type);
            else blockList.addSubnet(address, +prefix, type);
        }
    }

    return blockList;
}

/**
 * Returns the client IP, resolving `X-Forwarded-For` only through trusted proxies.
 *
 * Starting from the connection address, each trusted hop is replaced by the next `X-Forwarded-For` entry from the
 * right; the first untrusted address is the client. Trusted proxies come from `SERVER_TRUSTED_PROXIES` (comma-separated
 * IPs, CIDRs or `loopback` / `linklocal` / `uniquelocal`), defaulting to all three named subnets.
 *
 * Returns `undefined` only when the connection address is unavailable (e.g. unix sockets or `app.request()`).
 */
export function getClientIp(ctx: Context) {
    // Bun.serve passes the server as the second fetch argument, which Hono exposes as ctx.env.
    const server = ctx.env as Server<unknown> | undefined;
    let clientIp = normalizeIp(server?.requestIP(ctx.req.raw)?.address);
    const forwardedIps = ctx.req.header('x-forwarded-for')?.split(',') ?? [];
    while (clientIp && isTrustedProxy(clientIp)) {
        const forwardedIp = normalizeIp(forwardedIps.pop()?.trim());
        if (!forwardedIp) break;
        clientIp = forwardedIp;
    }

    return clientIp;
}

function isTrustedProxy(ip: string) {
    return trustedProxies.check(ip, isIP(ip) === 6 ? 'ipv6' : 'ipv4');
}

function normalizeIp(ip?: string) {
    if (!ip || !isIP(ip)) return;
    // Unwrap IPv4-mapped IPv6 addresses (::ffff:127.0.0.1) so callers always get plain IPv4.
    const mappedIpv4 = ip.toLowerCase().startsWith('::ffff:') ? ip.slice(7) : undefined;
    return mappedIpv4 && isIP(mappedIpv4) === 4 ? mappedIpv4 : ip;
}
