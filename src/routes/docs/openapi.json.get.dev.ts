import { createOpenApiDocumentHandler } from '@/core/libs/openapi';

export default defineRoute()(
    createOpenApiDocumentHandler({
        // Every route can fail unexpectedly; routes list only the errors they throw themselves.
        defaultDocs: { responses: apiDocs.errors(apiErrors.common.internalServerError) },
        documentation: {
            info: {
                title: 'API Document',
                version: '0.1.0',
            },
            // Tag descriptions, e.g. [{ description: '...', name: '...' }]
            tags: [],
        },
        // Routes for internal services (e.g. ws.io-server) are not part of the public API.
        exclude: /^\/api\/internal\//,
    }),
);
