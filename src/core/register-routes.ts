import { createRoute } from '@hono/zod-openapi';
import logger from '@kikiutils/node/consola';
import { showRoutes as showHonoAppRoutes } from 'hono/dev';
import { glob } from 'glob';
import { resolve } from 'path';

const allowedHttpMethods = [
	'delete',
	'get',
	'head',
	'link',
	'options',
	'patch',
	'post',
	'purge',
	'put',
	'unlink'
] as const;

export const registerRoutesFromFiles = async (app: typeof honoApp, scanDirPath: string, baseUrlPath: string = '/', showRoutes: boolean = false) => {
	scanDirPath = scanDirPath.replace(/\/$/, '');
	const routeFilePathPattern = new RegExp(`^${scanDirPath}(.*?)(/index)?\\.(${allowedHttpMethods.join('|')})\\.ts$`);
	let totalRouteCount = 0;
	const startTime = performance.now();
	const routeFilePaths = await glob(`${scanDirPath}/**/*.{${allowedHttpMethods.join(',')}}.ts`);
	for (const routeFilePath of routeFilePaths) {
		const absoluteRouteFilePath = resolve(routeFilePath);
		try {
			const routeModule = await import(absoluteRouteFilePath);
			if (!routeModule.default) continue;
			const filePathMatches = routeFilePath.match(routeFilePathPattern);
			if (!filePathMatches) continue;
			const method = filePathMatches[3]!;
			const routeEndpoint = `${baseUrlPath}${filePathMatches[1]!}`;
			if (routeModule.zodOpenApiRouteConfig) {
				app.openapi(
					createRoute({
						...routeModule.zodOpenApiRouteConfig,
						path: routeEndpoint.replace(/:(\w+?)(\/|$)/g, '{$1}$2'),
						method
					}),
					routeModule.default,
					routeModule.zodOpenApiRouteHook
				);
			} else app.on(method, routeEndpoint, routeModule.default);
			totalRouteCount++;
		} catch (error) {
			// @ts-expect-error
			logger.error(`Failed to load route file: ${absoluteRouteFilePath}`, error?.message, error);
		}
	}

	if (showRoutes) showHonoAppRoutes(app);
	logger.info(`Successfully registered ${totalRouteCount} routes in ${(performance.now() - startTime).toFixed(2)}ms`);
};