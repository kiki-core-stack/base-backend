import { autoImports as autoImportsPlugin } from '@/core/plugins/bun/auto-imports';

const macroTargets: string[] = [];
if (process.env.NODE_ENV === 'production') macroTargets.push('defineRouteHandlerOptions');
export const autoImports = autoImportsPlugin({
    globs: [
        // The default settings are generally safe to use; you won't need to modify them here.
        '@/core/globals/**/*.ts',

        // Add your own settings here.
        '@/globals/**/*.ts',
    ],
    macroTargets,
});
