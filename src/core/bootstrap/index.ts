import { plugin as registerPlugin } from 'bun';

import { logger } from '../logger';

logger.info('Loading bun plugins...');
const { default: bunPlugins } = await import(`@/plugins/bun/${process.env.NODE_ENV}`);
for (const plugin of bunPlugins) await registerPlugin(plugin);
logger.success('Bun plugins loaded');
