import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { SoftDeleteService } from './prisma.soft-delete.service';

/**
 * Module for soft delete functionality
 *
 * The soft delete middleware is automatically registered in PrismaService.onModuleInit()
 *
 * Import this module in your features that need soft delete utilities
 */
@Module({
  imports: [DatabaseModule],
  providers: [SoftDeleteService],
  exports: [SoftDeleteService],
})
export class SoftDeleteModule {}
