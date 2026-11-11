import { Glob } from 'bun';

import * as corePaths from '../../constants/paths';
import { allowedRouteHttpMethods } from '../../constants/route';
import type {
    RouteDefinition,
    RouteHttpMethod,
} from '../../types/route';

// Functions
export async function discoverRouteDefinitions() {
    const envSuffix = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
    const filePattern = new RegExp(
        `^${corePaths.routesDir.value}(.*?)(/index)?\\.(${allowedRouteHttpMethods.join('|')})(\\.${envSuffix})?\\.(mj|t)s$`,
    );

    const routeDefinitions: RouteDefinition[] = [];
    const scanner = new Glob('**/*.{mj,t}s').scan({
        absolute: true,
        cwd: corePaths.routesDir.value,
        onlyFiles: true,
    });

    for await (const filePath of scanner) {
        const matches = filePath.match(filePattern);
        if (!matches) continue;
        routeDefinitions.push({
            filePath,
            method: matches[3] as RouteHttpMethod,
            path: (matches[1]!.replaceAll(/\/+/g, '/') || '/').replaceAll(/\[([^/]+)\]/g, ':$1'),
        });
    }

    return routeDefinitions.sort((a, b) => routePathToRank(a.path) - routePathToRank(b.path));
}

function routePathSegmentToRankValue(segment: string, isLast: boolean) {
    if (segment === '*' && isLast) return 1e12;
    if (segment === '*') return 1e10;
    if (segment.startsWith(':') && segment.includes('.')) return 11;
    if (segment.startsWith(':')) return 111;
    return 1;
}

function routePathToRank(path: string) {
    const segments = path.split('/');
    return +segments.map((segment, i) => routePathSegmentToRankValue(segment, i === segments.length - 1)).join('');
}
