import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AppValidationPipe } from './common/pipes/validation.pipe';
import helmet from 'helmet';
import { AppConfigService } from './config/app-config.service';
import { Logger } from '@nestjs/common';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Get configuration service
  const configService = app.get(ConfigService);

  // Enable CORS
  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',') : '*',
    credentials: configService.get<boolean>('CORS_CREDENTIALS', true),
  });

  // Security middleware
  app.use(helmet());

  // Set global prefix
  app.setGlobalPrefix('api/v1');

  // Global validation pipe
  app.useGlobalPipes(AppValidationPipe);

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // FIXED: Enable shutdown hooks. 
  // This allows Nest to trigger onModuleDestroy() inside your QueueService automatically.
  app.enableShutdownHooks();

  // Swagger setup
  if (configService.get<boolean>('SWAGGER_ENABLED', true)) {
    const config = new DocumentBuilder()
      .setTitle('Stellar Insured API')
      .setDescription('API documentation for Stellar Insured backend')
      .setVersion(configService.get<string>('APP_VERSION', '1.0'))
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(
      configService.get<string>('SWAGGER_PATH', '/api/docs'),
      app,
      document,
    );
  }

    // Get port from config - Use typed getter
    const port = configService.port;
    logger.log(`📡 Attempting to start server on port ${port}...`);

    await app.listen(port);

    // Success message
    logger.log(`\n🎉 ==========================================`);
    logger.log(`🚀 ${configService.appName} v${configService.appVersion}`);
    logger.log(`🌍 Running on: http://localhost:${port}`);
    logger.log(`📊 Environment: ${configService.nodeEnv}`);
    logger.log(
      `📋 Swagger UI: http://localhost:${port}${configService.swaggerPath}`,
    );
    logger.log(`⚡ Health check: http://localhost:${port}/health`);
    logger.log(`🔗 Stellar Network: ${configService.stellarNetwork}`);
    logger.log(
      `💾 Database: ${configService.databaseHost}:${configService.databasePort}`,
    );
    logger.log(
      `🔄 Redis: ${configService.redisHost}:${configService.redisPort}`,
    );
    logger.log(`==========================================\n`);
  } catch (error) {
    logger.error('❌ Failed to bootstrap application:', error);

    // Log the full error stack
    if (error instanceof Error) {
      logger.error(`Error name: ${error.name}`);
      logger.error(`Error message: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
    } else {
      logger.error(`Unknown error: ${JSON.stringify(error)}`);
    }

  // Log startup information
  /* eslint-disable no-console */
  console.log(`\n Application is running on: http://localhost:${port}`);
  console.log(` Environment: ${configService.get('NODE_ENV', 'development')}`);
  console.log(`📋 Swagger UI: http://localhost:${port}/api/docs`);
  /* eslint-enable no-console */
}

void bootstrap();
