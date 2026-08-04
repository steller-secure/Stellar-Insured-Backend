import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { logger, nestWinstonLogger } from './config/winston.config';
import * as expressWinston from 'express-winston';
import * as winston from 'winston';
import { jsonReplacer } from './common/utils/json-replacer.util';
import { redactFormat } from './common/utils/log-redaction.util';
import { correlationIdHandler } from './middleware/correlation-id.middleware';

async function bootstrap() {
  const bootstrapLogger = new Logger('Bootstrap');
  let app;
  let configService: ConfigService;
  try {
    app = await NestFactory.create(AppModule, {
      logger: nestWinstonLogger,
    });
    configService = app.get(ConfigService);
  } catch (error) {
    bootstrapLogger.error(
      'Failed to start application due to configuration/validation errors:',
    );
    bootstrapLogger.error(error.message || error);
    process.exit(1);
  }

  // Application bootstrap setup
  // - create the Nest app with a shared Winston logger
  // - load config service for runtime configuration values
  // - apply middleware and global pipes before listening

  // Correlation ID / tracing context — must be the very first middleware so
  // that every subsequent middleware (including the request logger below)
  // and every downstream handler runs inside the AsyncLocalStorage scope.
  app.use(correlationIdHandler);

  // Cookie parser
  app.use(cookieParser());

  // Configure Express JSON serializer to handle BigInt, Decimal, and Date
  // This ensures consistent serialization across all response paths
  app.set('json replacer', jsonReplacer);

  // Security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    }),
  );

  // Request logging
  app.use(
    expressWinston.logger({
      winstonInstance: logger,
      statusLevels: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        redactFormat(),
      ),
      meta: true,
      expressFormat: true,
      colorize: false,
      bodyBlacklist: [
        'password',
        'secret',
        'token',
        'authorization',
        'cookie',
        'email',
        'pushSubscription',
        'privateKey',
        'encryptionKeys',
        'vapidPrivateKey',
        'apiKey',
        'walletAddress',
      ],
      headerBlacklist: ['authorization', 'cookie', 'x-api-key', 'x-auth-token'],
    }),
  );

  app.use(
    expressWinston.errorLogger({
      winstonInstance: logger,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        redactFormat(),
      ),
    }),
  );

  // CSRF protection disabled for API-only clients
  // Justification: This is a REST API serving stateless clients (mobile apps, SPAs, other services)
  // that use JWT tokens for authentication. CSRF protection is designed for cookie-based session
  // authentication in traditional web applications. For API-only services, CSRF adds unnecessary
  // complexity without meaningful security benefits, as JWT-based authentication is not vulnerable
  // to CSRF attacks. Security is maintained through proper CORS configuration, JWT validation,
  // and rate limiting.

  // Global validation pipe
  // - removes non-whitelisted properties
  // - rejects unrecognized payload fields
  // - keeps runtime types safe by avoiding implicit conversion
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // API prefix - version is now handled by NestJS versioning
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api');
  app.setGlobalPrefix(apiPrefix);

  // Enable URI-based API versioning (e.g. /api/v1/users, /api/v2/users)
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  // CORS - configured with explicit allowed origins for security
  const corsAllowedOrigins = configService
    .get<string>(
      'CORS_ALLOWED_ORIGINS',
      'http://localhost:3000,http://localhost:4200',
    )
    .split(',')
    .map(origin => origin.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (corsAllowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type,Authorization,X-Requested-With,Accept,Origin',
    maxAge: 86400, // 24 hours
  });

  // Enable NestJS shutdown hooks so lifecycle events (onModuleDestroy, etc.) fire on SIGTERM/SIGINT
  app.enableShutdownHooks();

  // Timeout configuration - aligned for security and performance
  // requestTimeout: Maximum time for a request to complete (30s)
  // keepAliveTimeout: Time to keep idle connections open (65s)
  // headersTimeout: Time to wait for headers (60s) - must be less than keepAliveTimeout
  const requestTimeoutMs = configService.get<number>(
    'REQUEST_TIMEOUT_MS',
    30000,
  );
  const headersTimeoutMs = configService.get<number>(
    'HEADERS_TIMEOUT_MS',
    60000,
  );
  const keepAliveTimeoutMs = configService.get<number>(
    'KEEP_ALIVE_TIMEOUT_MS',
    65000,
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setTimeout(requestTimeoutMs, () => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request Timeout',
          message: `Request exceeded ${requestTimeoutMs / 1000} second limit`,
        });
      }
    });
    next();
  });

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);

  const server = app.getHttpServer() as any;
  if (typeof server?.setTimeout === 'function') {
    server.setTimeout(requestTimeoutMs);
  }
  server.keepAliveTimeout = keepAliveTimeoutMs;
  server.headersTimeout = headersTimeoutMs;

  bootstrapLogger.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );

  // Graceful shutdown handling
  // Ensures the server stops accepting new requests, closes the HTTP server,
  // and allows Nest lifecycle hooks to fire before exiting.
  const shutdownTimeout = configService.get<number>('SHUTDOWN_TIMEOUT', 30000);
  let isShuttingDown = false;

  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    bootstrapLogger.log(`${signal} received. Starting graceful shutdown...`);

    const forceExitTimer = setTimeout(() => {
      logger.error(
        'Forced shutdown after timeout — could not complete gracefully',
      );
      process.exit(1);
    }, shutdownTimeout);

    try {
      // Stop accepting new connections
      const server = app.getHttpServer();
      server.close(() => {
        bootstrapLogger.log(
          'HTTP server closed — no longer accepting requests',
        );
      });

      // Close the NestJS app (triggers onModuleDestroy, onApplicationShutdown hooks)
      await app.close();

      clearTimeout(forceExitTimer);
      bootstrapLogger.log('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      bootstrapLogger.error(`Error during graceful shutdown: ${error.message}`);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap();
