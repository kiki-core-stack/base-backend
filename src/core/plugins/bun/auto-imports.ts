// TODO: cache and dts file content same check

import { Glob } from 'bun';
import type {
    Loader,
    PluginBuilder,
} from 'bun';
import {
    dirname,
    isAbsolute,
    join,
    resolve,
} from 'node:path';

import { escapeRegExp } from 'es-toolkit';
import {
    findExports,
    resolvePath as mllyResolvePath,
} from 'mlly';
import type { ESMExport } from 'mlly';
import { createUnimport } from 'unimport';
import type { Import } from 'unimport';

import {
    projectRoot,
    projectSrcDirPath,
} from '../../constants/paths';
import * as logger from '../../utils/logger';

interface AutoImportsOptions {
    globs: string[];
    imports: Import[];
    macroTargets: string[];
}

// Constants
const allowedExtensions = [
    '.ts',
    '.mjs',
    '.cjs',
    '.js',
];

const allowedExtensionsRegexpString = `(${allowedExtensions.map(escapeRegExp).join('|')})`;
const dtsFileHeader = `
// @ts-nocheck
// prettier-ignore
// ⚠️ AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// This file is excluded from Git via .gitignore.

`.trimStart();

// Functions
export function autoImports(options: Partial<AutoImportsOptions>) {
    return {
        name: 'bun-auto-imports',
        async setup(builder: PluginBuilder) {
            const resolvedOptions: AutoImportsOptions = {
                globs: [],
                imports: [],
                macroTargets: [],
                ...options,
            };

            // Normalize explicit imports
            const normalizedImports = await Promise.all(
                resolvedOptions.imports.map(async (importDefinition) => ({
                    ...importDefinition,
                    from: await resolveImportPath(importDefinition.from, projectRoot),
                })),
            );

            // Collect and parse source files
            const matchedFiles = await collectMatchedFiles(resolvedOptions.globs);

            // Parse each matched file with mlly.findExports() to extract export symbols
            // Only include named exports and named star exports; skip default exports and type declarations
            const parsedImports = await extractExportsAsImports(matchedFiles, resolvedOptions);

            // Create a new unimport context to handle auto-imports resolution
            const imports = parsedImports.concat(normalizedImports);
            const unimport = createUnimport({ imports });

            // Generate .d.ts file
            await Bun.write(
                join(projectSrcDirPath, 'core/.generated/auto-imports.d.ts'),
                `${dtsFileHeader}${await unimport.generateTypeDeclarations()}\n`,
            );

            // Register bun plugin if any imports, otherwise skip
            if (!imports.length) return;
            builder.onLoad(
                {
                    filter: new RegExp(
                        `${escapeRegExp(projectSrcDirPath)}.*${allowedExtensionsRegexpString}$`,
                        'i',
                    ),
                },
                async ({ path }) => {
                    const fileContent = await Bun.file(path).text();
                    const transformedFileContent = await unimport.injectImports(fileContent);
                    return {
                        contents: transformedFileContent.code,
                        loader: path.slice(-2) as Loader,
                    };
                },
            );

            logger.info(`[auto-imports] ${imports.length} imports resolved`);
        },
    };
}

async function collectFileExportsRecursively(filePath: string, visitedFiles: Set<string>, options: AutoImportsOptions) {
    if (visitedFiles.has(filePath)) return [];
    visitedFiles.add(filePath);

    const resolvedImports: Import[] = [];
    await Promise.all(
        findExports(await Bun.file(filePath).text()).map(async (esmExport) => {
            switch (esmExport.type) {
                case 'declaration':
                    esmExport.names.forEach((name) => {
                        let withProperties: Record<string, any> | undefined;
                        if (options.macroTargets.includes(name)) (withProperties ||= {}).type = 'macro';
                        resolvedImports.push({
                            declarationType: esmExport.declarationType,
                            from: filePath,
                            name,
                            with: withProperties,
                        });
                    });

                    break;
                case 'named':
                    await Promise.all(
                        esmExport.names.map(async (name) => {
                            resolvedImports.push({
                                declarationType: esmExport.declarationType,
                                from: esmExport.specifier
                                    ? await resolveImportPath(esmExport.specifier, dirname(filePath), true)
                                    : filePath,
                                name,
                            });
                        }),
                    );

                    break;
                case 'star': {
                    resolvedImports.push(
                        ...await resolveStarEsmExportToImportsRecursively(
                            filePath,
                            esmExport,
                            visitedFiles,
                            options,
                        ),
                    );

                    break;
                }
            }
        }),
    );

    return resolvedImports;
}

async function collectMatchedFiles(globPatterns: string[]) {
    const matchedFiles = new Set<string>();
    await Promise.all(
        globPatterns.filter(isEligibleSourceFile).map(async (pattern) => {
            const scanner = new Glob(await resolveImportPath(pattern, projectRoot)).scan({
                absolute: true,
                cwd: projectSrcDirPath,
                onlyFiles: true,
            });

            for await (const filePath of scanner) {
                if (
                    isEligibleSourceFile(filePath)
                    && new RegExp(`${allowedExtensionsRegexpString}$`, 'i').test(filePath)
                ) matchedFiles.add(filePath);
            }
        }),
    );

    return matchedFiles;
}

async function extractExportsAsImports(files: Set<string>, options: AutoImportsOptions) {
    const visitedFiles = new Set<string>();
    return (
        await Promise.all(
            [...files].map(async (filePath) => await collectFileExportsRecursively(filePath, visitedFiles, options)),
        )
    ).flat();
}

function isEligibleSourceFile(filePath: string) {
    return !filePath.endsWith('.d.ts') && !filePath.includes('node_modules');
}

async function resolveImportPath(path: string, relativePath: string, useMlly?: boolean) {
    // eslint-disable-next-line regexp/no-unused-capturing-group
    if (/^([./]|@\/)/.test(path)) {
        if (path.startsWith('@/')) return join(projectSrcDirPath, path.substring(2));
        else if (!isAbsolute(path)) return resolve(relativePath, path);
    }

    return useMlly ? await mllyResolvePath(path, { extensions: allowedExtensions }) : path;
}

async function resolveStarEsmExportToImportsRecursively(
    filePath: string,
    esmExport: ESMExport,
    visitedFiles: Set<string>,
    options: AutoImportsOptions,
) {
    if (!esmExport.specifier) return [];
    const resolvedImports: Import[] = [];
    const specifier = await resolveImportPath(esmExport.specifier, dirname(filePath), true);
    if (!esmExport.name) resolvedImports.push(...await collectFileExportsRecursively(specifier, visitedFiles, options));
    else {
        resolvedImports.push({
            as: esmExport.name,
            from: specifier,
            name: '*',
        });
    }

    return resolvedImports;
}
