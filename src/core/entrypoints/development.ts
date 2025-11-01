import { plugin as registerPlugin } from 'bun';

import bunPlugins from '@/plugins/bun/development';

import * as logger from '../utils/logger';

// Load bun plugins
logger.info('Loading bun plugins...');
for (const plugin of bunPlugins) await registerPlugin(plugin);
logger.success('Bun plugins loaded');

// Run app
await import('@/index');
