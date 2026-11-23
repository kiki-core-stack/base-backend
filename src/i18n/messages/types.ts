import type en from './en';

/**
 * The messages this backend defines, one catalog per locale in this directory (`<locale>.ts`); pack-defined messages
 * live in pack's catalogs. `en` is the reference: its shape is the type and the other locales `satisfies` it.
 */
export type AppMessages = typeof en;
