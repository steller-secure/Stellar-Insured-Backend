import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createSoftDeleteMiddleware } from './prisma.soft-delete.middleware';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Register soft delete middleware
    // This middleware automatically:
    // - Excludes soft-deleted records from queries by default
    // - Converts delete operations to soft delete (update with deletedAt)
    // - Can be overridden with includeDeleted: true flag
    this.$use(createSoftDeleteMiddleware({ excludeDeleted: true }));

    await this.$connect();
    this.logger.log('Connected to database');
    this.logger.log('Soft delete middleware registered');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }
  /**
   * Lightweight liveness check used by the Prisma health indicator.
   * Throws if the connection is down; callers should catch and translate.
   */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
