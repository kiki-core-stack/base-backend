export const allowedRouteHttpMethods = [
    'delete',
    'get',
    'head',
    'options',
    'patch',
    'post',
    'put',
] as const;

export const routeMetaSymbol = Symbol('routeMeta');
