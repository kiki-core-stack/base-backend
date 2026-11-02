import { Buffer } from 'node:buffer';

import { honoApp } from '@/core/app';
import { session } from '@/libs/middlewares/session';
import { cookieSessionTokenHandler } from '@/libs/middlewares/session/handlers/token';

const sessionCipherKeyEnvValue = process.env.SESSION_CIPHER_KEY;
if (!sessionCipherKeyEnvValue) throw new Error('Missing environment variable: SESSION_CIPHER_KEY');
const sessionCipherKey = Buffer.from(sessionCipherKeyEnvValue, 'ascii').toString('ascii');
if (sessionCipherKey.length !== 32) {
    throw new Error(`Invalid SESSION_CIPHER_KEY length: expected 32 bytes (256 bits for AES-256) when parsed as ASCII, but got ${sessionCipherKey.length} bytes`);
}

honoApp.use('/api/*', session(sessionCipherKey, cookieSessionTokenHandler));
