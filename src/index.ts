import '@kikiutils/kiki-core-stack-pack/hono-backend/setups/mongoose-model-statics';
import logger from '@kikiutils/node/consola';

import '@/core/globals/route';
import { registerRoutesFromFiles } from '@/core/route';
import { server } from '@/server';

// Scan files and register routes
await registerRoutesFromFiles(server, `${import.meta.dirname}/apis`, '/api');
await registerRoutesFromFiles(server, `${import.meta.dirname}/routes`, '/');

// Start server
const serverHost = process.env.SERVER_HOST || '127.0.0.1';
const serverPort = +(process.env.SERVER_PORT || 8000);
await server.listen(serverPort, serverHost);
logger.info(`Server started on http://${serverHost}:${serverPort}`);