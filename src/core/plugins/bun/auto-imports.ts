import { Glob } from 'bun';
import type {
    Loader,
    PluginBuilder,
} from 'bun';
import { isBuiltin } from 'node:module';
import { pathToFileURL } from 'node:url';

import { Path } from '@kikiutils/shared/classes/path';
import { escapeRegExp } from 'es-toolkit';
import {
    findExports,
    resolveModuleExportNames,
} from 'mlly';
import { objectKeys } from 'ts-extras';
import { createUnimport } from 'unimport';
import type { Import } from 'unimport';

import * as corePaths from '../../constants/paths';
import { logger } from '../../logger';

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
const allowedExtensionsRegexp = new RegExp(`${allowedExtensionsRegexpString}$`, 'i');
const dtsFileHeader = `
// @ts-nocheck
// prettier-ignore
// Auto-generated. Do not edit manually.
// Ignored by Git via .gitignore.

`.trimStart();

const dtsFilePath = corePaths.projectSrcDir.join('core/.generated/auto-imports.d.ts').value;

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
                from: normalizeImportPath(importDefinition.from, corePaths.projectRoot),
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
            ];

            const unimport = createUnimport({ imports });

            // Generate declarations
            await Bun.write(dtsFilePath, `${dtsFileHeader}${await unimport.generateTypeDeclarations()}\n`);

            // Register bun plugin if any imports, otherwise skip
            if (!imports.length) return;
            builder.onLoad(
                {
                    filter: new RegExp(
                        `${escapeRegExp(corePaths.projectSrcDir.value)}.*${allowedExtensionsRegexpString}$`,
                        'i',
                    ),
                },
                async ({ path }) => {
                    const fileContent = await Bun.file(path).text();
                    const transformedFileContent = await unimport.injectImports(fileContent);
                    return {
                        contents: transformedFileContent.code,
                        loader: path.slice(-2).toLowerCase() as Loader,
                    };
                },
            );

            logger.info(`[auto-imports] ${imports.length} imports resolved`);
        },
    };
}

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
            case 'default':
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
                const specifier = normalizeImportPath(esmExport.specifier, new Path(filePath).dirname());

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
                const fileDir = new Path(filePath).dirname();
                const specifier = normalizeImportPath(esmExport.specifier, fileDir);
                if (esmExport.name) {
                    resolvedImports.push({
                        as: esmExport.name,
                        from: specifier,
                        name: '*',
                    });
                } else if (new Path(specifier).isAbsolute()) {
                    resolvedImports.push(...await collectFileExportsRecursively(specifier, visitedFiles));
                } else {
                    // Keep the bare specifier and collect names without executing package code.
                    // Builtins have no source file, so read them from the already loaded runtime module.
                    const exportNames = isBuiltin(specifier)
                        ? objectKeys(process.getBuiltinModule(specifier) ?? {})
                        : await resolveModuleExportNames(specifier, { url: pathToFileURL(filePath) });

                    const namedExportNames = exportNames.filter((name) => name !== 'default');
                    if (!namedExportNames.length) {
                        logger.warn(`[auto-imports] No exports found for "export * from '${specifier}'" in ${filePath}; CJS packages cannot be parsed statically, use named re-exports instead`);
                    }

                    for (const name of namedExportNames) {
                        resolvedImports.push({
                            from: specifier,
                            name,
                        });
                    }
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
            const scanner = new Glob(normalizeImportPath(pattern, corePaths.projectRoot)).scan({
                absolute: true,
                cwd: corePaths.projectSrcDir.value,
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

function normalizeImportPath(path: string, basePath: Path) {
    if (path.startsWith('@/')) return corePaths.projectSrcDir.join(path.substring(2)).value;
    if (path.startsWith('.')) return Path.resolve(basePath, path).value;
    return path;
}
