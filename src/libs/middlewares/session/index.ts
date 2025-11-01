import type { BinaryLike } from 'node:crypto';

import { createMiddleware } from 'hono/factory';
import { Gcm } from 'node-ciphers/aes';
import onChange from 'on-change';

import {
    sessionChangedSymbol,
    sessionClearedSymbol,
} from './constants';
import type {
    PartialContextSessionData,
    SessionTokenHandler,
} from './types';
import {
    clearSession,
    popSession,
} from './utils';

type StoredData = [number, PartialContextSessionData];

export function session(cipherKey: BinaryLike, tokenHandler: SessionTokenHandler) {
    const cipher = new Gcm(
        cipherKey,
        {
            authTag: 'base64',
            decryptInput: 'base64',
            encryptOutput: 'base64',
            iv: 'base64',
        },
    );

    return createMiddleware(async (ctx, next) => {
        let sessionData = {};
        const sessionToken = tokenHandler.get(ctx);
        if (sessionToken) {
            const decryptedResult = cipher.decryptToJson<StoredData>(
                sessionToken.substring(40),
                sessionToken.substring(24, 40),
                sessionToken.substring(0, 24),
            );

            if (decryptedResult.ok && decryptedResult.value[0] + 86400000 > Date.now()) {
                sessionData = decryptedResult.value[1];
            } else tokenHandler.delete(ctx);
        }

        ctx.clearSession = clearSession.bind(ctx);
        ctx.popSession = popSession.bind(ctx);
        ctx.session = onChange(
            sessionData,
            () => {
                onChange.unsubscribe(ctx.session);
                ctx[sessionChangedSymbol] = true;
            },
            { ignoreSymbols: true },
        );

        await next();
        if (ctx[sessionClearedSymbol]) return tokenHandler.delete(ctx);
        if (!ctx[sessionChangedSymbol]) return;
        const encryptResult = cipher.encryptJson([
            Date.now(),
            ctx.session,
        ]);

        if (encryptResult.ok) {
            tokenHandler.set(ctx, `${encryptResult.value.authTag}${encryptResult.value.iv}${encryptResult.value.data}`);
        }
    });
}
