import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { config } from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export const createApp = () => {
  const app = express();

  app.set('trust proxy', config.app.trustProxyHops);

  app.use(
    helmet({
      contentSecurityPolicy: config.isProd,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: config.app.clientUrls,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(compression());
  app.use(morgan(config.isProd ? 'combined' : 'dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(config.cookie.secret));

  // Strict limits in production only; dev skips limiter (refresh retries exhaust 100/15min quickly)
  if (config.isProd) {
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      message: { success: false, message: 'Too many login attempts, please try again later' },
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api/v1/auth/login', authLimiter);
    app.use('/api/v1/auth/register', authLimiter);
    // Password-reset endpoints send e-mail and accept token guesses. They get their OWN counter (a shared
    // one would let routine token refreshes from a busy NAT address use up the login budget). Token
    // refresh stays on the global limiter below.
    const resetLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: { success: false, message: 'Too many password reset attempts, please try again later' },
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api/v1/auth/forgot-password', resetLimiter);
    app.use('/api/v1/auth/reset-password', resetLimiter);

    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      message: { success: false, message: 'Too many requests, please try again later' },
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api', limiter);
  }

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
