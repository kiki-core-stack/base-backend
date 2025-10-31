import { plugin as registerPlugin } from 'bun';

import bunPlugins from '@/plugins/bun/development';

// Load bun plugins
for (const plugin of bunPlugins) await registerPlugin(plugin);

// Run app
await import('@/index');
