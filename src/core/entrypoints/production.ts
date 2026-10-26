import type { Subprocess } from 'bun';
import { writeSync } from 'node:fs';
import { inspect } from 'node:util';

import { withTimeout } from 'es-toolkit/promise';

interface WorkerProcess {
    logPrefix: string;
    subprocess: Subprocess<'ignore', 'inherit', 'inherit'>;
}

// Constants/Variables
let shutdownPromise: Promise<void> | undefined;
const workersCount = Number(process.env.SERVER_WORKERS ?? 4);
const workerProcesses: WorkerProcess[] = [];

// Functions
function createAndSetWorker(index: number) {
    const subprocess = Bun.spawn({
        cmd: [
            process.execPath,
            './index.js',
            index.toString(),
            '--is-subprocess',
        ],
        onExit(subprocess, exitCode, signalCode, error) {
            const logPrefix = `[Worker ${index} (${subprocess.pid})]`;
            if (error) logger.error(logPrefix, `Exited due to error: ${error.message}\n`, error);
            else if (exitCode !== null) logger.info(logPrefix, `Exited with code ${exitCode}`);
            else if (signalCode !== null) logger.info(logPrefix, `Exited with signal ${signalCode}`);
            else logger.info(logPrefix, 'Exited with unknown reason');
            if (shutdownPromise) return logger.info(logPrefix, 'Main process shutting down... do not restart');
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
        logPrefix: `[Worker ${index} (${subprocess.pid})]`,
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
    return shutdownPromise ??= Promise
        .resolve()
        .then(() => {
            const timeoutController = new AbortController();
            return withTimeout(
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
                { signal: timeoutController.signal },
            ).finally(() => timeoutController.abort());
        })
        .catch((error) => {
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
