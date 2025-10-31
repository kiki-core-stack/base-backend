import { plugin as registerPlugin } from 'bun';

import appConfig from '@/app.config';

// Load plugins
for (const plugin of appConfig.plugins) await registerPlugin(plugin);
