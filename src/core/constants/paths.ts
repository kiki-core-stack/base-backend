/**
 * All paths are for development only.
 */

import {
    join,
    resolve,
    sep,
} from 'node:path';

export const projectRoot = /* @__PURE__ */ resolve(import.meta.dirname, '../../../').replaceAll(sep, '/');
export const projectDistDir = /* @__PURE__ */ join(projectRoot, 'dist');
export const projectSrcDir = /* @__PURE__ */ join(projectRoot, 'src');
export const productionRoutesLoader = /* @__PURE__ */ join(projectSrcDir, 'core/loaders/routes/production.ts');
export const routesDir = /* @__PURE__ */ join(projectSrcDir, 'routes');
