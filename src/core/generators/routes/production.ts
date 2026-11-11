import * as corePaths from '../../constants/paths';
import { discoverRouteDefinitions } from '../../libs/router/discovery';
import { logger } from '../../logger';

// Functions
const toSingleQuotedString = (value: string) => `'${value.replaceAll('\\', '\\\\').replaceAll('\'', '\\\'')}'`;

// Entrypoint
const startTime = performance.now();
logger.info('Generating production routes loader...');
const routeDefinitions = await discoverRouteDefinitions();
const outputLines = [
    '// Auto-generated. Do not edit manually.',
    `import { registerRoutes } from '../../libs/router/registry';`,
    '',
    ...routeDefinitions.map((routeDefinition, index) => `import * as r${index} from ${toSingleQuotedString(routeDefinition.filePath)};`),
    '',
    'registerRoutes([',
    ...routeDefinitions.map((routeDefinition, index) => [
        '    {',
        `        filePath: ${toSingleQuotedString(corePaths.projectSrcDir.relative(routeDefinition.filePath).value)},`,
        `        method: '${routeDefinition.method}',`,
        `        module: r${index},`,
        `        path: ${toSingleQuotedString(routeDefinition.path)},`,
        '    },',
    ].join('\n')),
    ']);',
];

await corePaths.productionRoutesLoader.writeFile(`${outputLines.join('\n')}\n`);
logger.success(`Generated ${routeDefinitions.length} production routes in ${(performance.now() - startTime).toFixed(2)}ms`);
