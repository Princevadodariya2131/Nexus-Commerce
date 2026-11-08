import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

export const logger = winston.createLogger({
  level: config.isProd ? 'info' : 'debug',
  format: combine(errors({ stack: true }), timestamp(), logFormat),
  transports: [
    // Containers and PaaS hosts collect stdout/stderr; no ANSI colours in production.
    new winston.transports.Console({
      format: config.isProd ? logFormat : combine(colorize(), logFormat),
    }),
    // File logging is opt-in: the container user cannot write to the image filesystem and
    // most hosts have an ephemeral disk, so writing files by default can crash startup.
    ...(config.isProd && process.env.LOG_TO_FILE === 'true'
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
});
