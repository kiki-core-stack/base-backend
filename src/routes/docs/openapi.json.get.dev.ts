import { createOpenApiDocumentHandler } from '@/core/libs/openapi';

export default defineRoute()(
    createOpenApiDocumentHandler({
        documentation: {
            info: {
                title: 'API Document',
                version: '0.1.0',
            },
            // Tag descriptions, e.g. [{ description: '...', name: '...' }]
            tags: [],
        },
    }),
);
