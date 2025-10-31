// TODO: cache and dts file content same check

import { Glob } from 'bun';
import type {
    Loader,
    PluginBuilder,
} from 'bun';
import { join } from 'node:path';

import { findExports } from 'mlly';
import { createUnimport } from 'unimport';
import type {
    Import,
    Unimport,

} from 'unimport';

import { projectSrcDirPath } from '@/core/constants/paths';

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

            // Collect all valid source files from the provided glob patterns for export analysis
            const matchedFiles = await collectMatchedFiles(resolvedOptions.globs);

            // Parse each matched file with mlly.findExports() to extract export symbols
            // Only include named exports and named star exports; skip default exports and type declarations
            const resolvedImports = await parseExportsToImports(matchedFiles);

            // Create a new unimport context to handle auto-import resolution
            const unimport = createUnimport({
                imports: [
                    ...resolvedImports,
                    ...resolvedOptions.imports,
                ],
            });

            // Write dts file
            await writeDtsFile(resolvedOptions.dts, unimport);

            // Register bun plugin if any imports, otherwise skip
            if (!resolvedImports.length) return;
            builder.onLoad(
                { filter: /\.cjs|js|mjs|ts$/i },
                async ({ path }) => {
                    const fileContent = await Bun.file(path).text();
                    const transformedFileContent = await unimport.injectImports(fileContent);
                    return {
                        contents: transformedFileContent.code,
                        loader: path.slice(-2) as Loader,
                    };
                },
            );
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
                if (isAllowedFile(filePath) && /\.cjs|js|mjs|ts$/i.test(filePath)) matchedFiles.add(filePath);
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

async function writeDtsFile(dtdFilePath: string, unimport: Unimport) {
    await Bun.write(dtdFilePath, `${dtsFileHeader}${await unimport.generateTypeDeclarations()}\n`);
}
