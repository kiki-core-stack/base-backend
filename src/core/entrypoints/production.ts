import type { Subprocess } from 'bun';
import { writeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';

import { withTimeout } from 'es-toolkit/promise';

interface WorkerProcess {
    logPrefix: string;
    subprocess: Subprocess<'ignore', 'inherit', 'inherit'>;
}

// Constants/Variables
let shutdownPromise: Promise<void> | undefined;
const workerEntrypoint = fileURLToPath(new URL('../../index.js', import.meta.url));
const workersCount = Number(process.env.SERVER_WORKERS ?? 4);
const workerProcesses: WorkerProcess[] = [];

// Functions
const getWorkerLogPrefix = (index: number, pid: number) => `[Worker ${index} (${pid})]`;

function createAndSetWorker(index: number) {
    const subprocess = Bun.spawn({
        cmd: [
            process.execPath,
            workerEntrypoint,
            index.toString(),
            '--is-subprocess',
        ],
        onExit(subprocess, exitCode, signalCode, error) {
            const logPrefix = getWorkerLogPrefix(index, subprocess.pid);
            if (error) logger.error(logPrefix, `Exited due to error: ${error.message}\n`, error);
            else if (exitCode !== null) logger.info(logPrefix, `Exited with code ${exitCode}`);
            else if (signalCode !== null) logger.info(logPrefix, `Exited with signal ${signalCode}`);
            else logger.info(logPrefix, 'Exited with unknown reason');

            if (shutdownPromise) {
                logger.info(logPrefix, 'Main process shutting down... do not restart');
                return;
            }

            logger.info(logPrefix, 'Restarting in 1 second...');
            setTimeout(() => !shutdownPromise && createAndSetWorker(index), 1000);
        },
        stdio: [
            'ignore',
            'inherit',
            'inherit',
        ],
    });

    workerProcesses[index] = {
        logPrefix: getWorkerLogPrefix(index, subprocess.pid),
        subprocess,
    };
}

function handleFatalError(error: unknown) {
    try {
        writeSync(process.stderr.fd, `Supervisor failed: ${inspect(error)}\n`);
    } finally {
        process.exit(1);
    }
}

function shutdown(signal: NodeJS.Signals = 'SIGTERM') {
    shutdownPromise ??= withTimeout(
        async () => {
            logger.info('Shutting down all workers...');
            const results = await Promise.allSettled(workerProcesses.map(async (workerProcess) => {
                workerProcess.subprocess.kill(signal);
                const exitCode = await workerProcess.subprocess.exited;
                if (exitCode !== 0) throw new Error(`${workerProcess.logPrefix} exited with code ${exitCode}`);
                logger.success(workerProcess.logPrefix, 'Process exited');
            }));

            const errors = results
                .filter((result) => result.status === 'rejected')
                .map((result) => result.reason);

            if (errors.length) throw new AggregateError(errors, 'Worker cleanup failed');
            logger.info('All workers shut down');
        },
        35 * 1000,
    ).catch((error) => {
        logger.error('Worker shutdown failed', error);
        process.exit(1);
    });
}

// exit listeners must be synchronous. Never leave child processes behind.
process.once(
    'exit',
    () => {
        for (const workerProcess of workerProcesses) {
            try {
                workerProcess.subprocess.kill('SIGKILL');
            } catch {
                // Continue terminating other children if a process has already gone away.
            }
        }
    },
);

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGUSR2', () => shutdown('SIGUSR2'));
process.once('uncaughtException', handleFatalError);
process.once('unhandledRejection', handleFatalError);

// Entrypoint
if (!Number.isSafeInteger(workersCount) || workersCount <= 0) {
    throw new Error('SERVER_WORKERS must be a positive safe integer');
}

logger.info(`Starting ${workersCount} workers...`);
for (let i = 0; i < workersCount; i++) createAndSetWorker(i);
