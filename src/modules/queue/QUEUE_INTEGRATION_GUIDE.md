"""
Queue Integration Implementation Guide
=====================================

This implementation provides BullMQ-based job queue integration with background
processing for audit logs, retry handling, and graceful shutdown support.

## Components

### 1. Queue Module (src/modules/queue/)
- **queue.module.ts**: Core queue configuration with Redis backend
- **queue.service.ts**: Service for queuing audit logs
- **processors/audit-log.processor.ts**: Processor for audit log jobs

### 2. Audit Log Service (src/common/)
- **audit-log.service.ts**: Service for queueing various audit events
- **listeners/claim-audit-log.listener.ts**: Example listener for claim events
- **audit-log.module.ts**: Module exporting audit logging functionality

## Configuration

The queue requires Redis to be running. Configure via environment variables:

```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          (optional)
REDIS_DB=0
QUEUE_JOB_ATTEMPTS=3
QUEUE_JOB_BACKOFF_DELAY=2000
```

## Features

### Retry and Failure Handling
- **Default Attempts**: 3 retries per job
- **Backoff Strategy**: Exponential backoff with 2-second initial delay
- **Failed Jobs**: Persisted for analysis (not automatically removed)
- **Stalled Detection**: 5-second interval with 2-stall max threshold

### Graceful Shutdown
- All queues are drained during application shutdown
- Queue connections properly closed
- Jobs in progress are allowed to complete before shutdown

### Health Checks
- Available at: GET /api/v1/health/queues
- Returns queue statistics:
  - active: Currently processing jobs
  - waiting: Jobs waiting to be processed
  - delayed: Jobs scheduled for later
  - failed: Failed jobs
  - completed: Successfully completed jobs

## Usage Examples

### Example 1: Integrate with Existing Services

To add audit logging to any service:

```typescript
import { AuditLogService } from 'src/common/services/audit-log.service';

@Injectable()
export class YourService {
  constructor(
    private auditLogService: AuditLogService,
  ) {}

  async yourMethod(userId: string, data: any) {
    // Your business logic
    const result = await this.businessLogic(data);

    // Queue audit log (non-blocking)
    await this.auditLogService.logAction(
      userId,
      'YOUR_ENTITY',
      result.id,
      'ACTION_NAME',
      { /* changes */ },
      { /* metadata */ }
    );

    return result;
  }
}
```

### Example 2: Using Specific Audit Methods

```typescript
// For claim actions
await this.auditLogService.logClaimAction(
  userId,
  claimId,
  'APPROVE',
  { approvalAmount: 1000 },
  { approvalReason: 'All documents verified' }
);

// For policy actions
await this.auditLogService.logPolicyAction(
  userId,
  policyId,
  'ISSUE',
  { premium: 500, coverage: 'comprehensive' }
);
```

### Example 3: Adding New Processors

To add a new background job processor:

1. Create processor in src/modules/queue/processors/
2. Add queue registration in queue.module.ts
3. Add corresponding method in queue.service.ts

```typescript
// processors/email.processor.ts
@Processor('emails')
export class EmailProcessor {
  @Process()
  async sendEmail(job: Job<EmailJobData>): Promise<void> {
    // Implementation
  }
}
```

## Event-Driven Integration

The ClaimAuditLogListener automatically captures claim events and queues audit logs:
- CLAIM_SUBMITTED
- CLAIM_APPROVED
- CLAIM_REJECTED
- CLAIM_SETTLED

No manual integration needed - just ensure AuditLogModule is imported.

## Monitoring

### Queue Statistics
GET /api/v1/health/queues - Returns current queue statistics

### Queue Operations
- Access via QueueService methods
- getQueueStats() - Get current statistics
- drainQueues() - Drain all pending jobs
- closeQueues() - Close queue connections

## Best Practices

1. **Non-blocking Audit**: Audit logging doesn't throw errors to avoid blocking main operations
2. **Retry Configuration**: Adjust QUEUE_JOB_ATTEMPTS and QUEUE_JOB_BACKOFF_DELAY per queue
3. **Failed Jobs**: Monitor failed jobs in Redis for operational visibility
4. **Graceful Shutdown**: The application automatically drains queues on shutdown
5. **Job IDs**: Jobs are uniquely identified with descriptive IDs for debugging

## Troubleshooting

1. **Queue not processing**: Ensure Redis is running and accessible
2. **Jobs not completing**: Check processor logs for errors
3. **Connection issues**: Verify REDIS_HOST and REDIS_PORT configuration
4. **Memory usage**: Configure Redis persistence and memory policy appropriately
"""
