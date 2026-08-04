import { Injectable } from '@nestjs/common';
import {
  LedgerCursor,
  ProcessedEvent,
  QuarantinedEvent,
  IndexerLog,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { SoftDeleteRepository } from '../repositories/soft-delete.repository';
import { BaseRepository } from '../repositories/base.repository';
import { TransactionClient } from '../repositories/repository.interface';

// ─── LedgerCursor ────────────────────────────────────────────────────────────

@Injectable()
export class LedgerCursorRepository extends SoftDeleteRepository<LedgerCursor> {
  constructor(prisma: PrismaService) {
    super(prisma, 'ledgerCursor');
  }

  async findByNetwork(network: string, tx?: TransactionClient): Promise<LedgerCursor | null> {
    return this.delegate(tx).findUnique({ where: { network } });
  }

  async upsertCursor(
    network: string,
    lastLedgerSeq: number,
    lastLedgerHash?: string | null,
    tx?: TransactionClient,
  ): Promise<LedgerCursor> {
    return this.delegate(tx).upsert({
      where: { network },
      update: { lastLedgerSeq, lastLedgerHash: lastLedgerHash ?? null },
      create: { network, lastLedgerSeq, lastLedgerHash: lastLedgerHash ?? null },
    });
  }

  async updateCursor(
    network: string,
    lastLedgerSeq: number,
    lastLedgerHash?: string,
    tx?: TransactionClient,
  ): Promise<LedgerCursor> {
    return this.delegate(tx).update({
      where: { network },
      data: { lastLedgerSeq, lastLedgerHash: lastLedgerHash ?? null },
    });
  }
}

// ─── ProcessedEvent ──────────────────────────────────────────────────────────

@Injectable()
export class ProcessedEventRepository extends SoftDeleteRepository<ProcessedEvent> {
  constructor(prisma: PrismaService) {
    super(prisma, 'processedEvent');
  }

  async countByEventAndNetwork(
    eventId: string,
    network: string,
    tx?: TransactionClient,
  ): Promise<number> {
    return this.delegate(tx).count({ where: { eventId, network } });
  }

  async upsertEvent(
    data: Prisma.ProcessedEventUncheckedCreateInput,
    tx?: TransactionClient,
  ): Promise<ProcessedEvent> {
    return this.delegate(tx).upsert({
      where: { eventId: data.eventId },
      update: {},
      create: data,
    });
  }
}

// ─── QuarantinedEvent ────────────────────────────────────────────────────────

@Injectable()
export class QuarantinedEventRepository extends BaseRepository<QuarantinedEvent> {
  constructor(prisma: PrismaService) {
    super(prisma, 'quarantinedEvent');
  }

  async upsertEvent(
    data: Prisma.QuarantinedEventUncheckedCreateInput,
    tx?: TransactionClient,
  ): Promise<QuarantinedEvent> {
    return this.delegate(tx).upsert({
      where: { eventId: data.eventId },
      update: {},
      create: data,
    });
  }
}

// ─── IndexerLog ──────────────────────────────────────────────────────────────

@Injectable()
export class IndexerLogRepository extends BaseRepository<IndexerLog> {
  constructor(prisma: PrismaService) {
    super(prisma, 'indexerLog');
  }

  async createLog(
    data: Prisma.IndexerLogCreateInput | Prisma.IndexerLogUncheckedCreateInput,
    tx?: TransactionClient,
  ): Promise<IndexerLog> {
    return this.delegate(tx).create({ data });
  }
}
