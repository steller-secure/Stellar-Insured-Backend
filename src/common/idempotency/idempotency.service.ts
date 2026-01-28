import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { IdempotencyKeyEntity } from './entities/idempotency-key.entity';

export interface IdempotencyRecord {
  idempotencyKey: string;
  userId: string | null;
  method: string;
  endpoint: string;
  requestHash: string | null;
  statusCode: number;
  response: any;
  status: 'SUCCESS' | 'ERROR' | 'PENDING';
  errorMessage?: string;
}

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  cachedResponse?: IdempotencyRecord;
}

/**
 * Service for managing idempotency keys
 * Handles deduplication of financial transactions and critical operations
 * Provides safe replay handling and automatic cleanup
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly DEFAULT_TTL_HOURS = 24;

  constructor(
    @InjectRepository(IdempotencyKeyEntity)
    private readonly idempotencyRepository: Repository<IdempotencyKeyEntity>,
  ) {}

  /**
   * Generate a hash of the request body for duplicate detection
   * @param body The request body to hash
   * @returns SHA256 hash of the body
   */
  private generateRequestHash(body: any): string {
    try {
      const bodyStr = JSON.stringify(body);
      return createHash('sha256').update(bodyStr).digest('hex');
    } catch (error) {
      this.logger.warn(`Failed to generate request hash: ${error.message}`);
      return '';
    }
  }

  /**
   * Check if a request with the same idempotency key has already been processed
   * @param idempotencyKey The idempotency key from the header
   * @param userId The user making the request
   * @param method HTTP method (POST, PUT, PATCH)
   * @param endpoint The API endpoint
   * @param requestBody The request body
   * @returns Result indicating if duplicate and any cached response
   */
  async checkIdempotency(
    idempotencyKey: string,
    userId: string | null,
    method: string,
    endpoint: string,
    requestBody: any,
  ): Promise<IdempotencyCheckResult> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    if (idempotencyKey.length > 255) {
      throw new BadRequestException('Idempotency-Key exceeds maximum length of 255 characters');
    }

    try {
      const existingRecord = await this.idempotencyRepository.findOne({
        where: {
          idempotencyKey,
          userId,
        },
      });

      if (!existingRecord) {
        return { isDuplicate: false };
      }

      // Request found, check if it's still valid
      if (existingRecord.expiresAt && new Date() > existingRecord.expiresAt) {
        // Record has expired, treat as new request
        await this.idempotencyRepository.remove(existingRecord);
        return { isDuplicate: false };
      }

      const currentRequestHash = this.generateRequestHash(requestBody);

      // Validate request consistency - same key should have same body
      if (
        existingRecord.requestHash &&
        currentRequestHash &&
        existingRecord.requestHash !== currentRequestHash
      ) {
        throw new BadRequestException(
          'Idempotency-Key was used with a different request body. ' +
            'Use a new Idempotency-Key for this request.',
        );
      }

      // If request is still pending, return conflict
      if (existingRecord.status === 'PENDING') {
        throw new ConflictException(
          'A request with this Idempotency-Key is currently being processed. ' +
            'Please wait and try again.',
        );
      }

      // Return the cached response
      const cachedResponse: IdempotencyRecord = {
        idempotencyKey: existingRecord.idempotencyKey,
        userId: existingRecord.userId,
        method: existingRecord.method,
        endpoint: existingRecord.endpoint,
        requestHash: existingRecord.requestHash,
        statusCode: existingRecord.statusCode || 200,
        response: existingRecord.response
          ? JSON.parse(existingRecord.response)
          : null,
        status: existingRecord.status,
        errorMessage: existingRecord.errorMessage,
      };

      return { isDuplicate: true, cachedResponse };
    } catch (error) {
      // Re-throw known errors
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }

      // Log unexpected errors but don't fail the request
      this.logger.error(
        `Error checking idempotency: ${error.message}`,
        error.stack,
      );
      return { isDuplicate: false };
    }
  }

  /**
   * Create or update an idempotency key record
   * Should be called at the start of processing a new request
   * @param idempotencyKey The idempotency key from the header
   * @param userId The user making the request
   * @param method HTTP method
   * @param endpoint The API endpoint
   * @param requestBody The request body
   * @returns The created/updated idempotency record
   */
  async createIdempotencyRecord(
    idempotencyKey: string,
    userId: string | null,
    method: string,
    endpoint: string,
    requestBody: any,
  ): Promise<IdempotencyKeyEntity> {
    const requestHash = this.generateRequestHash(requestBody);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.DEFAULT_TTL_HOURS);

    try {
      const record = this.idempotencyRepository.create({
        idempotencyKey,
        userId,
        method,
        endpoint,
        requestHash,
        status: 'PENDING',
        expiresAt,
      });

      return await this.idempotencyRepository.save(record);
    } catch (error) {
      this.logger.error(
        `Failed to create idempotency record: ${error.message}`,
        error.stack,
      );
      // Don't fail the request if we can't create the record
      // but log it for monitoring
      throw new InternalServerErrorException(
        'Failed to process idempotency key',
      );
    }
  }

  /**
   * Mark an idempotency record as successfully completed
   * @param idempotencyKey The idempotency key
   * @param userId The user making the request
   * @param statusCode HTTP status code
   * @param response The response body
   */
  async markAsSuccess(
    idempotencyKey: string,
    userId: string | null,
    statusCode: number,
    response: any,
  ): Promise<void> {
    try {
      const responseStr = JSON.stringify(response);

      await this.idempotencyRepository.update(
        {
          idempotencyKey,
          userId,
        },
        {
          status: 'SUCCESS',
          statusCode,
          response: responseStr,
          errorMessage: null,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark idempotency record as success: ${error.message}`,
        error.stack,
      );
      // Don't fail the request, just log the error
    }
  }

  /**
   * Mark an idempotency record as failed
   * @param idempotencyKey The idempotency key
   * @param userId The user making the request
   * @param statusCode HTTP status code
   * @param errorMessage Error message
   */
  async markAsError(
    idempotencyKey: string,
    userId: string | null,
    statusCode: number,
    errorMessage: string,
  ): Promise<void> {
    try {
      await this.idempotencyRepository.update(
        {
          idempotencyKey,
          userId,
        },
        {
          status: 'ERROR',
          statusCode,
          errorMessage,
          response: null,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark idempotency record as error: ${error.message}`,
        error.stack,
      );
      // Don't fail the request, just log the error
    }
  }

  /**
   * Clean up expired idempotency records
   * Should be called periodically (e.g., via a cron job)
   * @returns Number of records deleted
   */
  async cleanupExpiredRecords(): Promise<number> {
    try {
      // Delete records where expiresAt is in the past
      const result = await this.idempotencyRepository.delete({
        expiresAt: () => `expiresAt < NOW()`,
      } as any);

      this.logger.log(`Cleaned up ${result.affected || 0} expired idempotency records`);
      return result.affected || 0;
    } catch (error) {
      this.logger.error(
        `Failed to cleanup expired records: ${error.message}`,
        error.stack,
      );
      return 0;
    }
  }

  /**
   * Get all idempotency records for a user (for debugging/auditing)
   * @param userId The user ID
   * @param limit Maximum number of records to return
   * @returns Array of idempotency records
   */
  async getRecordsByUser(
    userId: string,
    limit: number = 100,
  ): Promise<IdempotencyKeyEntity[]> {
    return this.idempotencyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
