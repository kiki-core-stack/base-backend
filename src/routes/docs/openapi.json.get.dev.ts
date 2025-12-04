import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

import { zodOpenApiRegistry } from '@/core/constants/zod-openapi';

const tagToDescriptionMap: Record<string, string> = {};

const tags = Object
    .entries(tagToDescriptionMap)
    .map((entry) => ({
        description: entry[1],
        name: entry[0],
    }));

export default defineRouteHandlers((ctx) => {
    const definitions = zodOpenApiRegistry.definitions.toSorted((a, b) => {
        const aIsRoute = a.type === 'route';
        const bIsRoute = b.type === 'route';
        if (aIsRoute && bIsRoute) {
            const tagA = a.route.tags?.toSorted()[0];
            const tagB = b.route.tags?.toSorted()[0];
            if (tagA && tagB) return tagA.localeCompare(tagB);
            if (!tagA && tagB) return -1;
            if (tagA && !tagB) return 1;
            return 0;
        }

        if (aIsRoute) return -1;
        if (bIsRoute) return 1;
        return 0;
    });

    const generator = new OpenApiGeneratorV31(definitions);
    const document = generator.generateDocument({
        info: {
            title: 'API Document',
            version: '0.1.0',
        },
        openapi: '3.1.1',
    });

    document.tags = tags;
    ctx.header('content-type', 'application/json');
    return ctx.body(JSON.stringify(document, null, 2));
});
