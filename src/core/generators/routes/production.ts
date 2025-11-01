import { resolveModuleExportNames } from 'mlly';

import { productionRoutesLoaderPath } from '../../constants/paths';
import { discoverRouteDefinitions } from '../../libs/router';
import type { RouteDefinition } from '../../types/route';
import * as logger from '../../utils/logger';

// Constants
const importStatements: string[] = [];
const constantDeclarations: string[] = [];
const usedConstNames = new Set<string>();
const valueToConstMap = new Map<string, string>();

// Functions
async function buildRouteRegistrationSnippet(routeDefinition: RouteDefinition, index: number) {
    const moduleExports = await resolveModuleExportNames(routeDefinition.filePath);
    if (!moduleExports.includes('default')) {
        throw new Error(`No default export found in route at ${routeDefinition.filePath}`);
    }

    const importAlias = `route${index}`;
    importStatements.push(`import * as ${importAlias} from '${routeDefinition.filePath}';`);
    const methodConstName = getOrCreateConstName(routeDefinition.method);
    const pathConstName = getOrCreateConstName(routeDefinition.path);
    // eslint-disable-next-line style/max-len
    let registration = `registerRoute(${methodConstName}, ${pathConstName}, normalizeRouteHandlers(${importAlias}.default),`;
    if (moduleExports.includes('routeHandlerOptions')) registration += ` ${importAlias}.routeHandlerOptions,`;

    return `${registration.replace(/,\s*$/, '')});`;
}

function getOrCreateConstName(value: string) {
    if (valueToConstMap.has(value)) return valueToConstMap.get(value)!;

    let constName: string;
    do constName = `v${Math.random().toString(36).substring(2)}`;
    while (usedConstNames.has(constName));

    constantDeclarations.push(`const ${constName} = '${value}';`);
    usedConstNames.add(constName);
    valueToConstMap.set(value, constName);

    return constName;
}

// Entrypoint
const startTime = performance.now();
logger.info('Generating production routes loader...');
const registrationLines = await Promise.all((await discoverRouteDefinitions()).map(buildRouteRegistrationSnippet));
const outputLines = [
    '// @ts-nocheck',
    `import { normalizeRouteHandlers, registerRoute } from '../../libs/router';`,
    '',
    ...importStatements,
    '',
    ...constantDeclarations,
    '',
    ...registrationLines,
];

await Bun.write(productionRoutesLoaderPath, `${outputLines.join('\n').trim()}\n`);
logger.success(
    `Generated ${registrationLines.length} production routes in ${(performance.now() - startTime).toFixed(2)}ms`,
);
