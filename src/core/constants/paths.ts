/**
 * All paths are for development only.
 */

import { Path } from '@kikiutils/shared/classes/path';

export const projectRoot = Path.resolve(import.meta.dirname, '../../../');
export const projectDistDir = projectRoot.join('dist');
export const projectSrcDir = projectRoot.join('src');
export const productionRoutesLoader = projectSrcDir.join('core/loaders/routes/production.ts');
export const routesDir = projectSrcDir.join('routes');
