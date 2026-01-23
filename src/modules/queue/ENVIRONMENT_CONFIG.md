# Queue Integration - Environment Configuration

Add these environment variables to your `.env` file for queue configuration:

## Redis Configuration
```
# Redis connection settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=              # Leave empty if no password
REDIS_DB=0
```

## Queue Configuration
```
# Job retry and backoff settings
QUEUE_JOB_ATTEMPTS=3              # Number of retry attempts for failed jobs
QUEUE_JOB_BACKOFF_DELAY=2000      # Initial backoff delay in milliseconds
```

## Example .env Setup
```
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Queue
QUEUE_JOB_ATTEMPTS=3
QUEUE_JOB_BACKOFF_DELAY=2000
```

## Production Considerations

### Redis Persistence
In production, configure Redis persistence:
```bash
# Enable AOF (Append-Only File)
appendonly yes
appendfsync everysec

# Or use RDB (Snapshotting)
save 900 1      # Save if 900 seconds have passed and at least 1 key changed
save 300 10     # Save if 300 seconds have passed and at least 10 keys changed
save 60 10000   # Save if 60 seconds have passed and at least 10000 keys changed
```

### Redis Security
```bash
# Set a strong password
requirepass your_secure_password

# Configure bind address
bind 127.0.0.1              # Development
bind 0.0.0.0                # If using Docker/Network
```

### Queue Monitoring
Monitor queue health via:
- Health check: `GET /api/v1/health/queues`
- Admin stats: `GET /api/v1/admin/queues/stats` (requires ADMIN role)
- Queue health: `GET /api/v1/admin/queues/health` (requires ADMIN role)

### Scaling Considerations
- Each instance connects to the same Redis instance
- Multiple workers can process jobs in parallel
- Failed jobs are retained for debugging (not auto-removed)
- Configure `QUEUE_JOB_ATTEMPTS` based on job complexity
