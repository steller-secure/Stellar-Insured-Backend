import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Controller()
class SimpleController {
  @Get()
  hello() {
    return { message: 'Hello from simple app!' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [SimpleController],
})
class AppSimpleModule {}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    logger.log('🚀 Starting simplified app with ConfigModule...');

    const app = await NestFactory.create(AppSimpleModule, {
      logger: ['error', 'warn', 'log', 'debug'],
    });

    app.enableCors();
    await app.listen(4000);

    logger.log('✅ Simplified app running on http://localhost:4000');
    logger.log('✅ GET / should work');
  } catch (error) {
    logger.error('❌ Simplified app failed:', error);
    if (error instanceof Error) {
      logger.error('Stack:', error.stack);
    }
  }
}

bootstrap();
