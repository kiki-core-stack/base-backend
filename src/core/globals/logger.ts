import { createConsola } from 'consola';
import { colorize } from 'consola/utils';

const consola = createConsola({ formatOptions: { date: false } });
const createLogDateTimePrefix = () => `[${formatDate(new Date())}]`;
const logPrefix = Bun.argv.includes('--is-subprocess')
    ? colorize('cyan', `[Worker ${Bun.argv[2]} (${process.pid})]`)
    : colorize('green', '[Main worker]');

function formatDate(date: Date) {
    const p = (n: number, d: number = 2) => n.toString().padStart(d, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} `
      + `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}.${p(date.getMilliseconds(), 3)}`;
}

export const logger = {
    error: (...args: any[]) => consola.error(createLogDateTimePrefix(), logPrefix, ...args),
    info: (...args: any[]) => consola.info(createLogDateTimePrefix(), logPrefix, ...args),
    success: (...args: any[]) => consola.success(createLogDateTimePrefix(), logPrefix, ...args),
    warn: (...args: any[]) => consola.warn(createLogDateTimePrefix(), logPrefix, ...args),
};
