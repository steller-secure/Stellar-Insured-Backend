import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { BaseRepository } from '../repositories/base.repository';
import { TransactionClient } from '../repositories/repository.interface';

@Injectable()
export class AuditLogRepository extends BaseRepository<AuditLog> {
  constructor(prisma: PrismaService) {
    super(prisma, 'auditLog');
  }

  async createLog(
    data: Prisma.AuditLogCreateInput | Prisma.AuditLogUncheckedCreateInput,
    tx?: TransactionClient,
  ): Promise<AuditLog> {
    return this.delegate(tx).create({ data });
  }
}
