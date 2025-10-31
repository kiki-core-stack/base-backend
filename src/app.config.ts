import type { BunPlugin } from 'bun';

import { autoImports } from '@/core/plugins/auto-import';

interface AppConfig {
    plugins: BunPlugin[];
}

export default { plugins: [autoImports({ globs: [] })] } satisfies AppConfig;
