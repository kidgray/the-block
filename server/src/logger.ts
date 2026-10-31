import { pino, type Logger } from 'pino';
import type { Config } from './config.js';

export function createLogger({
  logLevel,
  prettyLogs,
}: Pick<Config, 'logLevel' | 'prettyLogs'>): Logger {
  return pino({
    level: logLevel,
    ...(prettyLogs && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
    }),
  });
}
