import { EnhancedDate } from '@kikiutils/shared/classes/enhanced-date';
import { createConsola } from 'consola';
import { colorize } from 'consola/utils';

// Constants
const consola = createConsola({ formatOptions: { date: false } });
const createLogDateTimePrefix = () => `[${new EnhancedDate().format('yyyy-MM-dd HH:mm:ss.SSS')}]`;
const logPrefix = Bun.argv.includes('--is-subprocess')
    ? colorize('cyan', `[Worker ${Bun.argv[2]} (${process.pid})]`)
    : colorize('green', '[Main worker]');

// Functions
export const error = (...args: any[]) => consola.error(createLogDateTimePrefix(), logPrefix, ...args);
export const info = (...args: any[]) => consola.info(createLogDateTimePrefix(), logPrefix, ...args);
export const success = (...args: any[]) => consola.success(createLogDateTimePrefix(), logPrefix, ...args);
export const warn = (...args: any[]) => consola.warn(createLogDateTimePrefix(), logPrefix, ...args);
