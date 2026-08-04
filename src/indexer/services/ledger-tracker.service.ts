import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SoftDeleteService } from '../../prisma.soft-delete.service';
import { LedgerCursor, LedgerInfo, ReorgDetectionResult } from '../types/ledger.types';
import {
  LedgerCursorRepository,
  ProcessedEventRepository,
  IndexerLogRepository,
} from '../../common/repositories/indexer.repository';

@Injectable()
export class LedgerTrackerService {
  private readonly logger = new Logger(LedgerTrackerService.name);
  private readonly network: string;
  private readonly reorgDepthThreshold: number;

  constructor(
    private readonly ledgerCursorRepository: LedgerCursorRepository,
    private readonly processedEventRepository: ProcessedEventRepository,
    private readonly indexerLogRepository: IndexerLogRepository,
    private readonly softDelete: SoftDeleteService,
    private readonly configService: ConfigService,
  ) {
    this.network = this.configService.get<string>('STELLAR_NETWORK', 'testnet');
    this.reorgDepthThreshold = this.configService.get<number>('INDEXER_REORG_DEPTH_THRESHOLD', 5);
  }

  async getLastCursor(): Promise<LedgerCursor | null> {
    const cursor = await this.ledgerCursorRepository.findByNetwork(this.network);
    if (!cursor) return null;
    return {
      id: cursor.id,
      network: cursor.network,
      lastLedgerSeq: cursor.lastLedgerSeq,
      lastLedgerHash: cursor.lastLedgerHash || undefined,
      updatedAt: cursor.updatedAt,
      createdAt: cursor.createdAt,
    };
  }

  async initializeCursor(startLedger: number): Promise<LedgerCursor> {
    this.logger.log(
      `Initializing ledger cursor at ledger ${startLedger} for network ${this.network}`,
    );
    const cursor = await this.ledgerCursorRepository.upsertCursor(
      this.network,
      startLedger,
      null,
    );
    return {
      id: cursor.id,
      network: cursor.network,
      lastLedgerSeq: cursor.lastLedgerSeq,
      lastLedgerHash: cursor.lastLedgerHash || undefined,
      updatedAt: cursor.updatedAt,
      createdAt: cursor.createdAt,
    };
  }

  async updateCursor(ledgerSeq: number, ledgerHash?: string): Promise<void> {
    await this.ledgerCursorRepository.updateCursor(this.network, ledgerSeq, ledgerHash);
    this.logger.debug(`Updated cursor to ledger ${ledgerSeq}`);
  }

  async detectReorg(currentLedger: LedgerInfo): Promise<ReorgDetectionResult> {
    const cursor = await this.getLastCursor();

    if (!cursor || !cursor.lastLedgerHash) {
      return {
        hasReorg: false,
        reorgDepth: 0,
        lastValidLedger: currentLedger.sequence - 1,
        newLatestLedger: currentLedger.sequence,
      };
    }

    if (currentLedger.sequence === cursor.lastLedgerSeq) {
      const hasReorg = currentLedger.hash !== cursor.lastLedgerHash;
      if (hasReorg) {
        this.logger.warn(
          `Re-org detected at ledger ${currentLedger.sequence}. ` +
            `Expected hash: ${cursor.lastLedgerHash}, Got: ${currentLedger.hash}`,
        );
      }
      return {
        hasReorg,
        reorgDepth: hasReorg ? 1 : 0,
        lastValidLedger: hasReorg ? currentLedger.sequence - 1 : currentLedger.sequence,
        newLatestLedger: currentLedger.sequence,
      };
    }

    if (currentLedger.sequence > cursor.lastLedgerSeq) {
      return {
        hasReorg: false,
        reorgDepth: 0,
        lastValidLedger: cursor.lastLedgerSeq,
        newLatestLedger: currentLedger.sequence,
      };
    }

    this.logger.warn(
      `Re-org detected. Current ledger ${currentLedger.sequence} is behind cursor ${cursor.lastLedgerSeq}`,
    );
    return {
      hasReorg: true,
      reorgDepth: cursor.lastLedgerSeq - currentLedger.sequence,
      lastValidLedger: currentLedger.sequence,
      newLatestLedger: currentLedger.sequence,
    };
  }

  async handleReorg(reorgResult: ReorgDetectionResult): Promise<number> {
    if (!reorgResult.hasReorg) return reorgResult.newLatestLedger;

    this.logger.warn(
      `Handling re-org with depth ${reorgResult.reorgDepth}. ` +
        `Rolling back to ledger ${reorgResult.lastValidLedger}`,
    );

    const rollbackDepth = Math.min(reorgResult.reorgDepth + 2, this.reorgDepthThreshold);
    const safeLedgerSeq = Math.max(0, reorgResult.lastValidLedger - rollbackDepth);

    // Hard-delete: eventId is unique so soft-deleted rows would block re-processing
    await this.softDelete.hardDeleteMany(
      'processedEvent',
      { network: this.network, ledgerSeq: { gt: safeLedgerSeq } },
      `Blockchain re-org rollback to ledger ${safeLedgerSeq}`,
    );

    this.logger.log(`Deleted processed events after ledger ${safeLedgerSeq}`);
    await this.updateCursor(safeLedgerSeq);
    this.logger.log(`Re-org handled. Resuming from ledger ${safeLedgerSeq}`);
    return safeLedgerSeq;
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    const count = await this.processedEventRepository.countByEventAndNetwork(
      eventId,
      this.network,
    );
    return count > 0;
  }

  async markEventProcessed(
    eventId: string,
    ledgerSeq: number,
    contractId: string,
    eventType: string,
    transactionHash: string,
  ): Promise<void> {
    await this.processedEventRepository.upsertEvent({
      eventId,
      network: this.network,
      ledgerSeq,
      contractId,
      eventType,
      transactionHash,
    });
  }

  async getStartLedger(latestLedger: number): Promise<number> {
    const cursor = await this.getLastCursor();
    const configuredStart = this.configService.get<number>('INDEXER_START_LEDGER');

    if (cursor) return cursor.lastLedgerSeq + 1;

    if (configuredStart) {
      this.logger.log(`Using configured start ledger: ${configuredStart}`);
      await this.initializeCursor(configuredStart - 1);
      return configuredStart;
    }

    this.logger.log(`Starting from current ledger: ${latestLedger}`);
    await this.initializeCursor(latestLedger - 1);
    return latestLedger;
  }

  async logProgress(
    currentLedger: number,
    targetLedger: number,
    eventsProcessed: number,
  ): Promise<void> {
    const remaining = targetLedger - currentLedger;
    const progress = ((currentLedger / targetLedger) * 100).toFixed(2);

    this.logger.log(
      `Progress: Ledger ${currentLedger}/${targetLedger} (${progress}%) | ` +
        `Events: ${eventsProcessed} | Remaining: ${remaining}`,
    );

    await this.indexerLogRepository.createLog({
      level: 'info',
      message: `Processed ledger ${currentLedger}`,
      metadata: {
        currentLedger,
        targetLedger,
        eventsProcessed,
        progress: parseFloat(progress),
        network: this.network,
      },
    });
  }

  async logError(message: string, metadata?: Record<string, unknown>): Promise<void> {
    this.logger.error(message, metadata);
    await this.indexerLogRepository.createLog({
      level: 'error',
      message,
      metadata: (metadata || {}) as any,
    });
  }
}
