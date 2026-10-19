import {
    mkdir,
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
import prettyBytes from 'pretty-bytes';

// Constants/Variables
const projectDirectoryPath = import.meta.dirname;
const outputDirectoryPath = join(projectDirectoryPath, 'dist');
const filesystemRootPath = parse(projectDirectoryPath).root;
const nativePackageNames = new Set(NodeNativePackages);

// Include dynamically selected transports or packages not visible to static tracing.
// This array is shared with nf3 so additions in traceResult are visible to it.
const additionalTracePackageNames: string[] = [];
// const additionalTracePackageNames: string[] = [
//     'pino-pretty',
//     'pino-roll',
// ];

const fullTracePackageEntries: NonNullable<ExternalsTraceOptions['fullTraceInclude']> = [
    ...FullTracePackages,
    'chromium-bidi',
    // Pino also publishes intentionally invalid test fixtures; copy only runtime files.
    [
        'pino',
        { glob: '{*.js,lib/**,LICENSE}' },
    ],
];

// Run
await rm(
    outputDirectoryPath,
    {
        force: true,
        recursive: true,
    },
);

const buildResult = await Bun.build({
    entrypoints: [join(projectDirectoryPath, 'src/index.ts')],
    minify: true,
    outdir: outputDirectoryPath,
    packages: 'external',
    target: 'bun',
    throw: false,
});

if (!buildResult.success) {
    for (const log of buildResult.logs) console.error(log);
    process.exit(1);
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
                for (const warning of fileTraceResult.warnings) console.warn(warning.message);

                // Native optional dependencies can be invisible to static tracing.
                // Add their names before nf3 resolves includes from each declaring package.
                for (const filePath of fileTraceResult.fileList) {
                    if (!filePath.endsWith('/package.json')) continue;
                    const packageManifest = await readPackageJSON(join(filesystemRootPath, filePath), { cache: true });
                    const includedPackageNames = Object
                        .keys({
                            ...packageManifest.dependencies,
                            ...packageManifest.optionalDependencies,
                        })
                        .filter((packageName) => nativePackageNames.has(packageName));

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
                    const extension = extname(filePath);
                    const isEsm = extension === '.mjs'
                      || (extension === '.js' && (await readPackageJSON(filePath, { cache: true })).type === 'module');

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
                        throw new Error([
                            `Failed to minify ${filePath}:`,
                            ...minifyResult.errors.map((error) => error.message),
                        ].join('\n'));
                    }

                    return minifyResult.code;
                },
            },
        ],
    },
);

// Tracing copies package files but does not recreate package-manager CLI links.
const executableDirectoryPath = join(outputDirectoryPath, 'node_modules/.bin');
for (const tracedPackage of Object.values(tracedLayout.packages)) {
    const packageDirectoryPath = join(outputDirectoryPath, tracedPackage.versions[tracedPackage.hoisted]!.outPath);
    const packageManifest = await readPackageJSON(join(packageDirectoryPath, 'package.json'), { cache: true });
    const executableRelativePaths: Record<string, string> = typeof packageManifest.bin === 'string'
        ? { [basename(tracedPackage.name)]: packageManifest.bin }
        : packageManifest.bin ?? {};

    for (const [executableName, executableRelativePath] of Object.entries(executableRelativePaths)) {
        const executableFilePath = join(packageDirectoryPath, executableRelativePath);
        const executableFileStats = await stat(executableFilePath).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
        });

        if (!executableFileStats?.isFile()) continue;
        await mkdir(executableDirectoryPath, { recursive: true });
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
    .sort((a, b) => b.size - a.size || a.path.localeCompare(b.path));

const outputPathColumnWidth = Math.max(0, ...outputs.map((output) => output.path.length));
const totalOutputSize = outputs.reduce((total, output) => total + output.size, 0);
process.stdout.write([
    'Build outputs (dist/):',
    ...outputs.map((output) => `  ${output.path.padEnd(outputPathColumnWidth)}  ${prettyBytes(output.size)}`),
    `Build completed: ${outputs.length} files, ${prettyBytes(totalOutputSize)} total`,
    `Copied ${Object.keys(tracedLayout.packages).length} runtime package(s).`,
    '',
].join('\n'));
