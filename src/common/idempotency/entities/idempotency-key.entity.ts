import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * Entity to store idempotency key records for deduplication
 * Prevents duplicate processing of financial transactions and critical operations
 */
@Entity('idempotency_keys')
@Index(['idempotencyKey', 'userId'], { unique: true })
@Index(['expiresAt'], { where: 'expires_at IS NOT NULL' })
@Index(['createdAt'])
export class IdempotencyKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The idempotency key provided by the client
   * Must be unique per user per endpoint
   */
  @Column('varchar', { length: 255 })
  idempotencyKey: string;

  /**
   * User ID associated with this request
   * Ensures idempotency keys are scoped per user
   */
  @Column('varchar', { nullable: true })
  userId: string | null;

  /**
   * HTTP method of the request (POST, PUT, PATCH)
   */
  @Column('varchar', { length: 10 })
  method: string;

  /**
   * API endpoint that was called
   * e.g., /api/v1/claims, /api/v1/policies, /api/v1/dao/proposals
   */
  @Column('varchar', { length: 255 })
  endpoint: string;

  /**
   * Hash of the request body for validation
   * Ensures retry requests have identical payloads
   */
  @Column('varchar', { length: 255, nullable: true })
  requestHash: string | null;

  /**
   * Status of the original request
   * PENDING - request is being processed
   * SUCCESS - request completed successfully
   * ERROR - request failed
   */
  @Column('varchar', { length: 20, default: 'PENDING' })
  status: 'PENDING' | 'SUCCESS' | 'ERROR';

  /**
   * HTTP status code of the response
   */
  @Column('integer', { nullable: true })
  statusCode: number | null;

  /**
   * Serialized response body for replay
   */
  @Column('text', { nullable: true })
  response: string | null;

  /**
   * Error message if the request failed
   */
  @Column('text', { nullable: true })
  errorMessage: string | null;

  /**
   * Timestamp when this record was created
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  /**
   * Timestamp when this record expires (TTL)
   * Records older than this can be safely deleted
   * Default: 24 hours from creation
   */
  @Column('timestamp', { nullable: true })
  expiresAt: Date | null;
}
