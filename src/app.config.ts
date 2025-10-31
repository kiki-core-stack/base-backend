import type { BunPlugin } from 'bun';

import { autoImports } from '@/core/plugins/auto-imports';

interface AppConfig {
    plugins: BunPlugin[];
}

export default {
    plugins: [
        autoImports({
            globs: [],
            imports: [
                // Default imports
                {
                    from: '@/core/app.ts',
                    name: 'defineRouteHandlers',
                },
            ],
        }),
    ],
} satisfies AppConfig;
