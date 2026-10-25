import { createLogger } from '@kikiutils/shared/logger';

export const logger = createLogger({
    prefix: Bun.argv.includes('--is-subprocess')
        ? `[Worker ${Bun.argv[2]} (${process.pid})]`
        : '[Main worker]',
});
