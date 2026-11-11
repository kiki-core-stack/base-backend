import { discoverRouteDefinitions } from '../../libs/router/discovery';
import { registerRoute } from '../../libs/router/registry';
import { logger } from '../../logger';

// Entrypoint
const startTime = performance.now();
const routeDefinitions = await discoverRouteDefinitions();
const routeModules = await Promise.all(
    routeDefinitions.map(async (routeDefinition) => {
        try {
            return await import(routeDefinition.filePath);
        } catch (error) {
            logger.error(`Failed to import route at ${routeDefinition.filePath}: ${(error as Error).message}\n`, error);
        }
    }),
);

let registeredRouteCount = 0;
for (const [index, routeDefinition] of routeDefinitions.entries()) {
    const module = routeModules[index];
    if (!module) continue;
    try {
        registerRoute({
            ...routeDefinition,
            module,
        });

        registeredRouteCount++;
    } catch (error) {
        logger.error((error as Error).message);
    }
}

logger.success(`Registered ${registeredRouteCount} routes in ${(performance.now() - startTime).toFixed(2)}ms`);
