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
import { findExports } from 'mlly';
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
const allowedExtensionsRegexp = new RegExp(`${allowedExtensionsRegexpString}$`, 'i');
const dtsFileHeader = `
// @ts-nocheck
// prettier-ignore
// Auto-generated. Do not edit manually.
// Ignored by Git via .gitignore.

`.trimStart();

const dtsFilePath = join(projectSrcDirPath, 'core/.generated/auto-imports.d.ts');

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
            const normalizedImports = resolvedOptions.imports.map((importDefinition) => ({
                ...importDefinition,
                from: normalizeImportPath(importDefinition.from, projectRoot),
            }));

            // Collect and parse source files
            const matchedFiles = await collectMatchedFiles(resolvedOptions.globs);

            // Parse each matched file with mlly.findExports() to extract export symbols
            // Only include named exports and named star exports; skip default exports and type declarations
            const parsedImports = await extractExportsAsImports(matchedFiles);

            // Create a new unimport context to handle auto-imports resolution
            const imports = [
                ...parsedImports,
                ...normalizedImports,
            ].map(
                (importDefinition) =>
                    resolvedOptions.macroTargets.includes(importDefinition.as ?? importDefinition.name)
                        ? {
                            ...importDefinition,
                            with: {
                                ...importDefinition.with,
                                type: 'macro',
                            },
                        }
                        : importDefinition,
            );

            const unimport = createUnimport({ imports });

            // Generate declarations
            await Bun.write(dtsFilePath, `${dtsFileHeader}${await unimport.generateTypeDeclarations()}\n`);

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

// TODO: Before disabling packages: 'external', recheck Bun's handling of bundled re-exports.
// Bun 1.4.3 can emit undefined bindings when a bundled package re-exports an external module
// (for example, export * from 'node:path'), even without minification or code splitting.
// Preserving package specifiers below respects the build setting but does not fix that Bun bug.
async function collectFileExportsRecursively(filePath: string, visitedFiles: Set<string>): Promise<Import[]> {
    if (visitedFiles.has(filePath)) return [];
    visitedFiles.add(filePath);

    const resolvedImports: Import[] = [];
    for (const esmExport of findExports(await Bun.file(filePath).text())) {
        switch (esmExport.type) {
            case 'declaration':
                for (const name of esmExport.names) {
                    if (name === 'default') continue;
                    resolvedImports.push({
                        declarationType: esmExport.declarationType,
                        from: filePath,
                        name,
                    });
                }

                break;
            case 'named': {
                if (!esmExport.specifier) {
                    for (const name of esmExport.names) {
                        if (name === 'default') continue;
                        resolvedImports.push({
                            declarationType: esmExport.declarationType,
                            from: filePath,
                            name,
                        });
                    }

                    break;
                }

                // Preserve bare package specifiers so packages: 'external' still applies.
                const specifier = normalizeImportPath(esmExport.specifier, dirname(filePath));

                // Keep the original binding and exported alias without importing the barrel.
                const bindings = /^export\s*\{([^}]*)\}/.exec(esmExport.code)?.[1] ?? '';
                for (const binding of bindings.split(',')) {
                    const [name, exportedName = name] = binding.trim().split(/\s+as\s+/);
                    if (
                        !name
                        || !exportedName
                        || exportedName === 'default'
                        || !esmExport.names.includes(exportedName)
                    ) continue;

                    resolvedImports.push({
                        as: exportedName,
                        declarationType: esmExport.declarationType,
                        from: specifier,
                        name,
                    });
                }

                break;
            }
            case 'star': {
                if (!esmExport.specifier) break;
                // Preserve bare package specifiers so packages: 'external' still applies.
                const specifier = normalizeImportPath(esmExport.specifier, dirname(filePath));

                if (esmExport.name) {
                    resolvedImports.push({
                        as: esmExport.name,
                        from: specifier,
                        name: '*',
                    });
                } else {
                    // TODO: Handle Node builtins without reading them as files during recursive scans.
                    // This limitation applies regardless of the packages: 'external' setting.
                    const resolvedFilePath = Bun.resolveSync(specifier, dirname(filePath));
                    resolvedImports.push(...await collectFileExportsRecursively(resolvedFilePath, visitedFiles));
                }

                break;
            }
        }
    }

    return resolvedImports;
}

async function collectMatchedFiles(globPatterns: string[]) {
    const matchedFiles = new Set<string>();
    await Promise.all(
        globPatterns.filter(isEligibleSourceFile).map(async (pattern) => {
            const scanner = new Glob(normalizeImportPath(pattern, projectRoot)).scan({
                absolute: true,
                cwd: projectSrcDirPath,
                onlyFiles: true,
            });

            for await (const filePath of scanner) {
                if (
                    isEligibleSourceFile(filePath)
                    && allowedExtensionsRegexp.test(filePath)
                ) matchedFiles.add(filePath);
            }
        }),
    );

    return Array.from(matchedFiles).sort();
}

async function extractExportsAsImports(files: string[]) {
    const visitedFiles = new Set<string>();
    const imports: Import[] = [];
    for (const filePath of files) imports.push(...await collectFileExportsRecursively(filePath, visitedFiles));
    return imports;
}

function isEligibleSourceFile(filePath: string) {
    return !filePath.endsWith('.d.ts') && !filePath.includes('node_modules');
}

function normalizeImportPath(path: string, relativePath: string) {
    if (path.startsWith('@/')) return join(projectSrcDirPath, path.substring(2));
    if (path.startsWith('.') && !isAbsolute(path)) return resolve(relativePath, path);
    return path;
}
