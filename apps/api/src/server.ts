import http from 'http';
import jwt from 'jsonwebtoken';
import { Server as SocketServer } from 'socket.io';
import { createApp } from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase, prisma } from './lib/prisma';
import { attachSocketAuth, type IoLike, type VerifiedToken } from './realtime/socketAuth';
import { logger } from './utils/logger';

const bootstrap = async () => {
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);

  const io = new SocketServer(server, {
    cors: { origin: config.app.clientUrls, credentials: true },
  });

  // Connections must authenticate, and rooms are authorised per user/role (see realtime/socketAuth.ts).
  attachSocketAuth(io as unknown as IoLike, {
    verifyToken: (token) => jwt.verify(token, config.jwt.secret) as unknown as VerifiedToken,
    loadUser: (id) => prisma.user.findUnique({ where: { id }, select: { isActive: true, role: true } }),
    loadVendorId: async (userId) => {
      const vendor = await prisma.vendor.findUnique({
        where: { userId },
        select: { id: true, status: true },
      });
      return vendor && vendor.status === 'approved' ? vendor.id : null;
    },
    log: (message) => logger.warn(message),
  });

  io.on('connection', (socket) => {
    logger.debug(`WebSocket connected: ${socket.id}`);
    socket.on('disconnect', () => logger.debug(`WebSocket disconnected: ${socket.id}`));
  });

  app.set('io', io);

  server.listen(config.app.port, () => {
    logger.info(`${config.app.name} API running on port ${config.app.port}`);
    logger.info(`MySQL database connected`);
    logger.info(`Environment: ${config.env}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully...`);

    // Do not let open keep-alive/WebSocket connections block the exit forever.
    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    // io.close() also stops the attached HTTP server and disconnects WebSocket clients.
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
};

// Log fatal errors before exiting so the host's log stream shows why the process died;
// the platform's restart policy brings it back.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
