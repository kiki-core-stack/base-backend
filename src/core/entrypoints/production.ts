import type { Subprocess } from 'bun';

import { colorize } from 'consola/utils';

interface WorkerProcess {
    logPrefix: string;
    subprocess: Subprocess<'inherit', 'inherit', 'inherit'>;
}

let isShuttingDown = false;
const workersCount = Number(process.env.SERVER_WORKERS) || 4;
const workerProcesses: WorkerProcess[] = Array.from({ length: workersCount });

function createAndSetWorker(index: number) {
    const subprocess = Bun.spawn({
        cmd: [
            'bun',
            'run',
            './index.js',
            index.toString(),
            '--is-subprocess',
            `--worker-index=${index}`,
        ],
        onExit(_subprocess, exitCode, signalCode, error) {
            const logPrefix = workerProcesses[index]!.logPrefix;
            if (error) logger.error(logPrefix, `Exited due to error: ${error.message}\n`, error);
            else if (exitCode !== null) logger.info(logPrefix, `Exited with code ${exitCode}`);
            else if (signalCode !== null) logger.info(logPrefix, `Exited with signal ${signalCode}`);
            else logger.info(logPrefix, 'Exited with unknown reason');
            if (isShuttingDown) return logger.info(logPrefix, 'Main process shutting down... do not restart');
            logger.info(logPrefix, 'Restarting in 1 second...');
            setTimeout(() => !isShuttingDown && createAndSetWorker(index), 1000);
        },
        stdio: [
            'inherit',
            'inherit',
            'inherit',
        ],
    });

    workerProcesses[index] = {
        logPrefix: colorize('cyan', `[Worker ${index} (${subprocess.pid})]`),
        subprocess,
    };
}

async function shutdown(exitCode?: NodeJS.Signals | number) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info('Shutting down all workers...');
    await Promise.all(
        workerProcesses.map(async (workerProcess) => {
            logger.info(workerProcess.logPrefix, 'Killing process...');
            workerProcess.subprocess.kill(exitCode);
            await workerProcess.subprocess.exited;
            logger.success(workerProcess.logPrefix, 'Process exited');
        }),
    );

    logger.info('All workers shut down');
}

// Entrypoint
logger.info(`Starting ${workersCount} workers...`);
for (let i = 0; i < workersCount; i++) createAndSetWorker(i);
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
process.once('exit', shutdown);
