import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import { AuditActionType } from '../enums/audit-action-type.enum';

@Entity('audit_logs')
@Index(['actor', 'timestamp'])
@Index(['entityReference', 'timestamp'])
@Index(['actionType', 'timestamp'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AuditActionType,
  })
  actionType: AuditActionType;

  @Column({ type: 'varchar', length: 255 })
  actor: string; // user ID or wallet address

  @CreateDateColumn({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  entityReference?: string; // policy ID, claim ID, etc.

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}