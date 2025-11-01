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

import { projectSrcDirPath } from '../../constants/paths';
import * as logger from '../../utils/logger';

interface AutoImportsOptions {
    globs: string[];
    imports: Import[];
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
                ...options,
            };

            // Normalize explicit imports
            const normalizedImports = resolvedOptions.imports.map((importDefinition) => ({
                ...importDefinition,
                from: resolveImportPath(importDefinition.from),
            }));

            // Collect and parse source files
            const matchedFiles = await collectMatchedFiles(resolvedOptions.globs);

            // Parse each matched file with mlly.findExports() to extract export symbols
            // Only include named exports and named star exports; skip default exports and type declarations
            const parsedImports = await extractExportsAsImports(matchedFiles);

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

async function collectFileExportsRecursively(filePath: string, visitedFiles: Set<string>) {
    if (visitedFiles.has(filePath)) return [];
    visitedFiles.add(filePath);

    const resolvedImports: Import[] = [];
    await Promise.all(
        findExports(await Bun.file(filePath).text()).map(async (esmExport) => {
            switch (esmExport.type) {
                case 'declaration':
                case 'named':
                    esmExport.names.forEach((name) => {
                        resolvedImports.push({
                            declarationType: esmExport.declarationType,
                            from: filePath,
                            name,
                        });
                    });

                    break;
                case 'star': {
                    resolvedImports.push(
                        ...await resolveStarEsmExportToImportsRecursively(
                            filePath,
                            esmExport,
                            visitedFiles,
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
            const scanner = new Glob(resolveImportPath(pattern)).scan({
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

async function extractExportsAsImports(files: Set<string>) {
    const visitedFiles = new Set<string>();
    return (
        await Promise.all(
            [...files].map(async (filePath) => await collectFileExportsRecursively(filePath, visitedFiles)),
        )
    ).flat();
}

function isEligibleSourceFile(filePath: string) {
    return !filePath.endsWith('.d.ts') && !filePath.includes('node_modules');
}

function resolveImportPath(path: string) {
    if (path.startsWith('@/')) return join(projectSrcDirPath, path.substring(2));
    else if (!isAbsolute(path)) return resolve(projectSrcDirPath, path);
    return path;
}

async function resolveStarEsmExportToImportsRecursively(
    filePath: string,
    esmExport: ESMExport,
    visitedFiles: Set<string>,
) {
    if (!esmExport.specifier) return [];

    const resolvedImports: Import[] = [];
    let specifier = esmExport.specifier;
    // eslint-disable-next-line regexp/no-unused-capturing-group
    if (/^([./]|@\/)/.test(specifier)) {
        if (specifier.startsWith('@/')) specifier = join(projectSrcDirPath, specifier.substring(2));
        else if (!isAbsolute(specifier)) specifier = resolve(dirname(filePath), specifier);
    }

    specifier = await mllyResolvePath(specifier, { extensions: allowedExtensions });
    if (!esmExport.name) resolvedImports.push(...await collectFileExportsRecursively(specifier, visitedFiles));
    else {
        resolvedImports.push({
            as: esmExport.name,
            from: specifier,
            name: '*',
        });
    }

    return resolvedImports;
}
