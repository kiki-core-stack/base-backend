import {
    discoverRouteDefinitions,
    normalizeRouteHandlers,
    registerRoute,
} from '../../libs/router';

// Entrypoint
const startTime = performance.now();
const routeDefinitions = await discoverRouteDefinitions();
const loadedRouteModules = await Promise.all(
    routeDefinitions.map(async (routeDefinition) => {
        try {
            return {
                ...routeDefinition,
                module: await import(routeDefinition.filePath),
            };
        } catch (error) {
            logger.error(`Failed to import route at ${routeDefinition.filePath}: ${(error as Error).message}\n`, error);
        }
    }),
);

let loadedRouteCount = 0;
for (const routeEntry of loadedRouteModules.filter((loadedRouteModule) => loadedRouteModule !== undefined)) {
    const handlers = normalizeRouteHandlers(routeEntry.module.default);
    if (!handlers.length) {
        logger.warn(`No handler found for route at ${routeEntry.filePath}`);
        continue;
    }

    registerRoute(
        routeEntry.method,
        routeEntry.path,
        handlers,
        routeEntry.module.routeHandlerOptions,
    );

    loadedRouteCount++;
}

logger.success(`Registered ${loadedRouteCount} routes in ${(performance.now() - startTime).toFixed(2)}ms`);
