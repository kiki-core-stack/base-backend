// TODO: cache and dts file content same check

import { Glob } from 'bun';
import type {
    Loader,
    PluginBuilder,
} from 'bun';
import {
    isAbsolute,
    join,
    resolve,
} from 'node:path';

import { findExports } from 'mlly';
import { createUnimport } from 'unimport';
import type {
    Import,
    Unimport,
} from 'unimport';

import { projectSrcDirPath } from '@/core/constants/paths';
import { logger } from '@/core/utils/logger';

interface AutoImportsOptions {
    dts: string;
    globs: string[];
    imports: Import[];
}

// Constants
const dtsFileHeader = `
/* eslint-disable */
// @ts-nocheck
// prettier-ignore
// ⚠️ AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// This file is excluded from Git via .gitignore.

`;

// Functions
export const isAllowedFile = (filePath: string) => !filePath.endsWith('.d.ts') && !filePath.includes('node_modules');

export function autoImports(options: Partial<AutoImportsOptions>) {
    return {
        name: 'auto-imports',
        async setup(builder: PluginBuilder) {
            const resolvedOptions: AutoImportsOptions = {
                dts: join(projectSrcDirPath, 'core/.generated/auto-imports.d.ts'),
                globs: [],
                imports: [],
                ...options,
            };

            // Normalize imports
            const normalizedImports = resolvedOptions.imports.map((importDef) => {
                let from = importDef.from;
                if (from.startsWith('@/')) from = join(projectSrcDirPath, from.slice(2));
                else if (!isAbsolute(from)) from = resolve(projectSrcDirPath, from);
                return {
                    ...importDef,
                    from,
                };
            });

            // Collect all valid source files from the provided glob patterns for export analysis
            const matchedFiles = await collectMatchedFiles(resolvedOptions.globs);

            // Parse each matched file with mlly.findExports() to extract export symbols
            // Only include named exports and named star exports; skip default exports and type declarations
            const resolvedImports = await parseExportsToImports(matchedFiles);

            // Create a new unimport context to handle auto-import resolution
            const imports = resolvedImports.concat(normalizedImports);
            const unimport = createUnimport({ imports });

            // Write dts file
            await writeDtsFile(resolvedOptions.dts, unimport);

            // Register bun plugin if any imports, otherwise skip
            if (!imports.length) return;
            builder.onLoad(
                { filter: /\.(cjs|js|mjs|ts)$/i },
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

async function collectMatchedFiles(globPatterns: string[]) {
    const matchedFiles = new Set<string>();
    await Promise.all(
        globPatterns.filter(isAllowedFile).map(async (pattern) => {
            const scanner = new Glob(pattern).scan({
                absolute: true,
                cwd: projectSrcDirPath,
                onlyFiles: true,
            });

            for await (const filePath of scanner) {
                // eslint-disable-next-line regexp/no-unused-capturing-group
                if (isAllowedFile(filePath) && /\.(cjs|js|mjs|ts)$/i.test(filePath)) matchedFiles.add(filePath);
            }
        }),
    );

    return matchedFiles;
}

async function parseExportsToImports(files: Set<string>) {
    const resolvedImports: Import[] = [];
    await Promise.all(
        [...files].map(async (filePath) => {
            const fileContent = await Bun.file(filePath).text();
            findExports(fileContent).forEach((esmExport) => {
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
                    case 'star':
                        if (esmExport.name) {
                            resolvedImports.push({
                                declarationType: esmExport.declarationType,
                                from: filePath,
                                name: esmExport.name,
                            });
                        }

                        break;
                }
            });
        }),
    );

    return resolvedImports;
}

async function writeDtsFile(dtsFilePath: string, unimport: Unimport) {
    await Bun.write(dtsFilePath, `${dtsFileHeader}${await unimport.generateTypeDeclarations()}\n`);
}
