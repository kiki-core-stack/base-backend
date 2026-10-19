import {
    mkdir,
    readdir,
    rm,
    stat,
    symlink,
} from 'node:fs/promises';
import {
    basename,
    extname,
    join,
    parse,
    relative,
} from 'node:path';

import { traceNodeModules } from 'nf3';
import type { ExternalsTraceOptions } from 'nf3';
import {
    FullTracePackages,
    NodeNativePackages,
} from 'nf3/db';
import { minify } from 'oxc-minify';
import { readPackageJSON } from 'pkg-types';
import type { PackageJson } from 'pkg-types';
import prettyBytes from 'pretty-bytes';

export type BuildOptions = Partial<Pick<Bun.BuildConfig, 'entrypoints' | 'plugins' | 'root' | 'splitting'>> & {
    additionalTracePackageNames?: readonly string[];
    failOnTraceWarnings?: boolean;
    fullTracePackageEntries?: ExternalsTraceOptions['fullTraceInclude'];

    /**
     * Override automatic classification; false suppresses and true retains the full warning.
     * Explicitly required dependencies cannot be suppressed.
     */
    traceWarningFilter?: (warning: Error) => boolean;
};

type TraceWarningClassification =
  | { dependencySpecifier: string; packageName: string; type: 'optional' }
  | { type: 'ignored' | 'warning' };

// Constants/Variables
const projectDirectoryPath = import.meta.dirname;
const outputDirectoryPath = join(projectDirectoryPath, 'dist');
const executableDirectoryPath = join(outputDirectoryPath, 'node_modules/.bin');
const filesystemRootPath = parse(projectDirectoryPath).root;

const defaultFullTracePackageEntries: NonNullable<ExternalsTraceOptions['fullTraceInclude']> = [
    ...FullTracePackages,
    'chromium-bidi',
    // Pino also publishes intentionally invalid test fixtures; copy only runtime files.
    [
        'pino',
        { glob: '{*.js,lib/**,LICENSE}' },
    ],
];

// Compatibility fallback for optional integrations not declared in package metadata.
const optionalDependencySpecifiersByFile: Record<string, readonly string[]> = {
    'debug/src/node.js': ['supports-color'],
    'node-fetch/lib/index.js': ['encoding'],
};

const optionalTracePackageNames = [
    'pino-pretty',
    'pino-roll',
];

const traceWarningPattern = /^Failed to resolve dependency "([^"]+)":\nCannot find module '[^']+' loaded from (.+)$/;

// Functions
export async function runBuild(options: BuildOptions = {}) {
    const packageManifestCache = new Map<string, PackageJson>();
    const projectManifest = await readPackageJSON(
        join(projectDirectoryPath, 'package.json'),
        { cache: packageManifestCache },
    );

    const requiredTracePackageNames = new Set([
        ...Object.keys(projectManifest.dependencies ?? {}).filter(
            (packageName) => !Object.hasOwn(projectManifest.optionalDependencies ?? {}, packageName),
        ),
        ...options.additionalTracePackageNames ?? [],
    ]);

    async function classifyTraceWarning(warning: Error): Promise<TraceWarningClassification> {
        const warningMatch = traceWarningPattern.exec(warning.message);
        const dependencySpecifier = warningMatch?.[1];
        const importerFilePath = warningMatch?.[2]?.replaceAll('\\', '/');
        const dependencyPackageName = dependencySpecifier?.startsWith('@')
            ? dependencySpecifier.split('/').slice(0, 2).join('/')
            : dependencySpecifier?.split('/')[0];

        // Explicit requirements take precedence over every suppression rule.
        if (dependencyPackageName && requiredTracePackageNames.has(dependencyPackageName)) {
            throw new Error(warning.message, { cause: warning });
        }

        const warningFilterResult = options.traceWarningFilter?.(warning);
        if (warningFilterResult === false) return { type: 'ignored' };
        if (warningFilterResult === true || !dependencySpecifier || !importerFilePath || !dependencyPackageName) {
            return { type: 'warning' };
        }

        // A missing subpath may indicate an invalid import, not an uninstalled optional package.
        if (dependencySpecifier !== dependencyPackageName) return { type: 'warning' };

        // This import is guarded by Hono's Cloudflare runtime check, never used by Bun.
        if (
            dependencySpecifier === 'cloudflare:workers'
            && importerFilePath.endsWith('/node_modules/hono/dist/utils/color.js')
        ) {
            return { type: 'ignored' };
        }

        // Use the actual declaring package, including isolated/nested installations.
        const importerPathMatch = /^(.*\/node_modules\/((?:@[^/]+\/)?[^/]+))\/(.+)$/.exec(importerFilePath);
        const packageDirectoryPath = importerPathMatch?.[1];
        const packageName = importerPathMatch?.[2];
        const relativeFilePath = importerPathMatch?.[3];
        if (!packageDirectoryPath || !packageName || !relativeFilePath) return { type: 'warning' };

        const packageManifest = await readPackageJSON(
            join(packageDirectoryPath, 'package.json'),
            { cache: packageManifestCache },
        );

        const isOptionalDependency = Object.hasOwn(packageManifest.optionalDependencies ?? {}, dependencyPackageName)
          || (
              !Object.hasOwn(packageManifest.dependencies ?? {}, dependencyPackageName)
              && packageManifest.peerDependenciesMeta?.[dependencyPackageName]?.optional === true
          )
          || optionalDependencySpecifiersByFile[`${packageName}/${relativeFilePath}`]?.includes(dependencySpecifier);

        return isOptionalDependency
            ? {
                dependencySpecifier,
                packageName,
                type: 'optional',
            }
            : { type: 'warning' };
    }

    const optionalDependencySpecifiersByPackage = new Map<string, Set<string>>();
    let optionalDependencyCount = 0;
    let ignoredTraceWarningCount = 0;
    let unresolvedTraceWarningCount = 0;

    // Include dynamically selected transports or packages not visible to static tracing.
    // This array is shared with nf3 so additions in traceResult are visible to it.
    const additionalTracePackageNames = [...options.additionalTracePackageNames ?? []];
    for (const packageName of optionalTracePackageNames) {
        try {
            Bun.resolveSync(packageName, projectDirectoryPath);
            if (!additionalTracePackageNames.includes(packageName)) additionalTracePackageNames.push(packageName);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND') throw error;
        }
    }

    const fullTracePackageEntries: NonNullable<ExternalsTraceOptions['fullTraceInclude']> = [
        ...options.fullTracePackageEntries ?? [],
        ...defaultFullTracePackageEntries,
    ];

    await rm(
        outputDirectoryPath,
        {
            force: true,
            recursive: true,
        },
    );

    const buildResult = await Bun.build({
        entrypoints: options.entrypoints ?? [join(projectDirectoryPath, 'src/index.ts')],
        minify: true,
        outdir: outputDirectoryPath,
        packages: 'external',
        plugins: options.plugins,
        root: options.root,
        splitting: options.splitting,
        target: 'bun',
        throw: false,
    });

    if (!buildResult.success) {
        for (const log of buildResult.logs) console.error(log);
        throw new Error('Application build failed');
    }

    const tracedLayout = await traceNodeModules(
        buildResult.outputs
            .filter((output) => output.kind === 'entry-point' || output.kind === 'chunk')
            .map((output) => output.path),
        {
            chmod: true,
            conditions: [
                'bun',
                'default',
                'import',
                'node',
                'production',
            ],
            fullTraceInclude: fullTracePackageEntries,
            hooks: {
                async traceResult(fileTraceResult) {
                    for (const warning of fileTraceResult.warnings) {
                        const warningClassification = await classifyTraceWarning(warning);
                        if (warningClassification.type === 'ignored') {
                            ignoredTraceWarningCount++;
                            continue;
                        }

                        if (warningClassification.type === 'optional') {
                            const { dependencySpecifier, packageName } = warningClassification;
                            let dependencySpecifiers = optionalDependencySpecifiersByPackage.get(packageName);
                            if (!dependencySpecifiers) {
                                dependencySpecifiers = new Set();
                                optionalDependencySpecifiersByPackage.set(packageName, dependencySpecifiers);
                            }

                            if (!dependencySpecifiers.has(dependencySpecifier)) {
                                dependencySpecifiers.add(dependencySpecifier);
                                optionalDependencyCount++;
                            }

                            continue;
                        }

                        unresolvedTraceWarningCount++;
                        console.warn(warning.message);
                    }

                    const retainedWarningCount = unresolvedTraceWarningCount + optionalDependencyCount;
                    if (options.failOnTraceWarnings && retainedWarningCount > 0) {
                        throw new Error([
                            `Dependency tracing failed with ${retainedWarningCount} warning(s)`,
                            ...sortOptionalDependencySpecifiers(optionalDependencySpecifiersByPackage).map(
                                ([packageName, dependencySpecifiers]) =>
                                    `${packageName}: ${dependencySpecifiers.join(', ')}`,
                            ),
                        ].join('\n'));
                    }

                    // Native optional dependencies can be invisible to static tracing.
                    // Add their names before nf3 resolves includes from each declaring package.
                    for (const filePath of fileTraceResult.fileList) {
                        if (!filePath.endsWith('/package.json')) continue;
                        const packageManifest = await readPackageJSON(
                            join(filesystemRootPath, filePath),
                            { cache: packageManifestCache },
                        );

                        const includedPackageNames = Object
                            .keys({
                                ...packageManifest.dependencies,
                                ...packageManifest.optionalDependencies,
                            })
                            .filter((packageName) => NodeNativePackages.includes(packageName));

                        for (const packageName of includedPackageNames) {
                            if (!additionalTracePackageNames.includes(packageName)) {
                                additionalTracePackageNames.push(packageName);
                            }
                        }
                    }
                },
            },
            nft: { base: filesystemRootPath },
            outDir: outputDirectoryPath,
            rootDir: projectDirectoryPath,
            traceInclude: additionalTracePackageNames,
            transform: [
                {
                    filter: (filePath) => /\.[cm]?js$/.test(filePath),
                    async handler(sourceCode, filePath) {
                        const fileExtension = extname(filePath);
                        const isEsm = fileExtension === '.mjs'
                          || (
                              fileExtension === '.js'
                              && (await readPackageJSON(filePath, { cache: packageManifestCache })).type === 'module'
                          );

                        const minifyResult = await minify(
                            `${filePath}${isEsm ? '.mjs' : '.cjs'}`,
                            sourceCode,
                            {
                                codegen: { legalComments: 'inline' },
                                compress: {
                                    keepNames: {
                                        class: true,
                                        function: true,
                                    },
                                },
                                mangle: {
                                    keepNames: true,
                                    reserved: [
                                        'exports',
                                        'module',
                                    ],
                                },
                                module: isEsm,
                            },
                        );

                        if (minifyResult.errors.length) {
                            throw new Error(
                                [
                                    `Failed to minify ${filePath}:`,
                                    ...minifyResult.errors.map((error) => error.message),
                                ].join('\n'),
                            );
                        }

                        return minifyResult.code;
                    },
                },
            ],
        },
    );

    // Explicit includes must resolve, including those declared by nested traced packages.
    for (const packageName of options.additionalTracePackageNames ?? []) {
        if (!tracedLayout.packages[packageName]) {
            throw new Error(`Required runtime package "${packageName}" could not be traced`);
        }
    }

    // Tracing copies package files but does not recreate package-manager CLI links.
    let isExecutableDirectoryCreated = false;
    for (const tracedPackage of Object.values(tracedLayout.packages)) {
        const packageDirectoryPath = join(outputDirectoryPath, tracedPackage.versions[tracedPackage.hoisted]!.outPath);
        const packageManifest = await readPackageJSON(
            join(packageDirectoryPath, 'package.json'),
            { cache: packageManifestCache },
        );

        const executableRelativePaths: Record<string, string> = typeof packageManifest.bin === 'string'
            ? { [basename(tracedPackage.name)]: packageManifest.bin }
            : packageManifest.bin ?? {};

        for (const [executableName, executableRelativePath] of Object.entries(executableRelativePaths)) {
            const executableFilePath = join(packageDirectoryPath, executableRelativePath);
            const executableFileStats = await stat(executableFilePath).catch((error: NodeJS.ErrnoException) => {
                if (error.code !== 'ENOENT') throw error;
            });

            if (!executableFileStats?.isFile()) continue;
            if (!isExecutableDirectoryCreated) {
                await mkdir(executableDirectoryPath, { recursive: true });
                isExecutableDirectoryCreated = true;
            }

            await symlink(
                relative(executableDirectoryPath, executableFilePath),
                join(executableDirectoryPath, executableName),
            );
        }
    }

    const outputs = buildResult.outputs
        .map((output) => ({
            path: relative(outputDirectoryPath, output.path),
            size: output.size,
        }))
        .sort((left, right) => right.size - left.size || left.path.localeCompare(right.path));

    const outputPathColumnWidth = Math.max(0, ...outputs.map((output) => output.path.length));
    const bundleSizeBytes = outputs.reduce((total, output) => total + output.size, 0);
    const pendingDirectoryPaths = [outputDirectoryPath];
    let totalOutputSizeBytes = 0;

    // Count regular files across dist without following package or executable symlinks.
    for (const directoryPath of pendingDirectoryPaths) {
        const directoryEntries = await readdir(directoryPath, { withFileTypes: true });
        for (const entry of directoryEntries) {
            const entryPath = join(directoryPath, entry.name);
            if (entry.isDirectory()) pendingDirectoryPaths.push(entryPath);
            else if (entry.isFile()) totalOutputSizeBytes += (await stat(entryPath)).size;
        }
    }

    const outputFileLines = outputs.map(
        (output) => `  ${output.path.padEnd(outputPathColumnWidth)}  ${prettyBytes(output.size)}`,
    );

    const traceSummaryParts = [
        `${unresolvedTraceWarningCount} ${unresolvedTraceWarningCount === 1 ? 'warning' : 'warnings'}`,
        `${optionalDependencyCount} optional missing`,
    ];

    if (ignoredTraceWarningCount > 0) traceSummaryParts.push(`${ignoredTraceWarningCount} ignored`);

    const summaryLines = [
        `Bundle: ${outputs.length} ${outputs.length === 1 ? 'file' : 'files'}, ${prettyBytes(bundleSizeBytes)}`,
        `Runtime packages: ${Object.keys(tracedLayout.packages).length}`,
        `Total output: ${prettyBytes(totalOutputSizeBytes)}`,
        `Dependency trace: ${traceSummaryParts.join(', ')}`,
    ];

    const reportSections = [
        'Build completed',
        [
            'Outputs (dist/):',
            ...outputFileLines,
        ].join('\n'),
        summaryLines.join('\n'),
    ];

    if (optionalDependencySpecifiersByPackage.size > 0) {
        const sortedOptionalDependencies = sortOptionalDependencySpecifiers(optionalDependencySpecifiersByPackage);
        const packageNameColumnWidth = Math.max(
            ...sortedOptionalDependencies.map(([packageName]) => packageName.length),
        );

        const dependencyLines = sortedOptionalDependencies.map(
            ([packageName, dependencySpecifiers]) =>
                `  ${packageName.padEnd(packageNameColumnWidth)}  ${dependencySpecifiers.join(', ')}`,
        );

        reportSections.push(
            [
                'Optional dependencies missing:',
                ...dependencyLines,
            ].join('\n'),
            'Only install these dependencies if their features are used.',
        );
    }

    process.stdout.write(`${reportSections.join('\n\n')}\n`);

    return {
        buildResult,
        tracedLayout,
    };
}

function sortOptionalDependencySpecifiers(
    dependencySpecifiersByPackage: Map<string, Set<string>>,
): [string, string[]][] {
    return [...dependencySpecifiersByPackage]
        .sort(([leftPackageName], [rightPackageName]) => leftPackageName.localeCompare(rightPackageName))
        .map(([packageName, dependencySpecifiers]) => [
            packageName,
            [...dependencySpecifiers].sort(),
        ]);
}

if (import.meta.main) await runBuild();
