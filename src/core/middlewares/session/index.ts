import type { BinaryLike } from 'crypto';
import { AESCipher } from 'node-ciphers';
import onChange from 'on-change';

import { sessionChangedSymbol, sessionClearedSymbol } from './constants';
import type { PartialContextSessionData, SessionTokenHandler } from './types';

type StoredData = [number, PartialContextSessionData];

export default (dataCipherKey: BinaryLike, tokenHandler: SessionTokenHandler) => {
	const dataCipher = new AESCipher.GCM(dataCipherKey, {
		authTag: 'base64',
		decryptInput: 'base64',
		encryptOutput: 'base64',
		iv: 'base64'
	});

	return defaultHonoFactory.createMiddleware(async (ctx, next) => {
		let sessionData = {};
		const sessionToken = tokenHandler.get(ctx);
		if (sessionToken) {
			const storedData = dataCipher.decryptToJSON<StoredData>(sessionToken.substring(40), sessionToken.substring(24, 40), sessionToken.substring(0, 24));
			if (storedData && storedData[0] + 86400000 > Date.now()) sessionData = storedData[1];
			else tokenHandler.delete(ctx);
		}

		ctx.session = onChange(sessionData, () => (ctx[sessionChangedSymbol] = true), { ignoreSymbols: true });
		await next();
		if (ctx[sessionClearedSymbol]) return tokenHandler.delete(ctx);
		if (!ctx[sessionChangedSymbol]) return;
		const encryptResult = dataCipher.encryptJSON([Date.now(), sessionData]);
		if (encryptResult) tokenHandler.set(ctx, `${encryptResult.authTag}${encryptResult.iv}${encryptResult.data}`);
	});
};