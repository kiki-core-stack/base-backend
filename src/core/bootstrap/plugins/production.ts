import { plugin as registerPlugin } from 'bun';

import { logger } from '../../globals/logger';

// Load bun plugins
logger.info('Loading bun plugins...');
const { default: bunPlugins } = await import(`@/plugins/bun/${process.env.NODE_ENV}`);
for (const plugin of bunPlugins) await registerPlugin(plugin);
logger.success('Bun plugins loaded');
