📘 BACKEND README

(NestJS – Stellar Insured Backend API)

Stellar Insured ⚙️ — Backend API

The Stellar Insured backend is a secure and scalable API layer that supports decentralized insurance operations such as policy management, claims processing, DAO governance, oracle verification, and analytics.

Built with NestJS, this backend serves frontend clients, DAO participants, and third-party integrations, while coordinating off-chain logic such as fraud detection and data aggregation—without compromising the trustless nature of Stellar-based smart contracts.

✨ Core Responsibilities

Insurance policy lifecycle management

Claim submission and verification

DAO proposals, voting, and result tracking

Oracle data ingestion

Fraud detection and monitoring

Analytics and reporting APIs

🗂️ Data Model Notes

Insurance is the primary product domain for this service.

The Prisma schema includes insurance models for pools, policies, claims, reinsurance contracts, and audit logs. Legacy project/contribution models remain in place because the Stellar event indexer, reputation scoring, and notification flows still depend on them while the broader data layer is being consolidated.

## 🗑️ Soft-Delete Policy

All 20 tracked models use **soft-delete by default**: deleting a record stamps
`deletedAt` with the current timestamp rather than issuing a SQL `DELETE`. The
Prisma middleware (`createSoftDeleteMiddleware`) enforces this transparently —
every standard `findMany`, `findUnique`, `update`, and `delete` call is already
covered. Hard deletes (permanent removal) are restricted to `SoftDeleteService`
and explicitly approved GDPR/admin paths, and always write an `AuditLog` entry.

For the full lifecycle model, query conventions, repository patterns, restore
vs. purge rules, and instructions for adding a new model, see
**[SOFT_DELETE_GUIDE.md](SOFT_DELETE_GUIDE.md)**.

## 📦 Response Serialization

Every response passes through a global interceptor
(`ResponseTransformInterceptor`) that enforces one public envelope:

**Success** — `{ "success": true, "data": ..., "meta": ... }`

**Error** — `{ "success": false, "error": { code, message, details, timestamp, path, requestId } }`

### Fields removed from public responses

The only field deliberately stripped from public responses is `deletedAt` —
the soft-delete marker (see [Soft-Delete Policy](#soft-delete-policy)). It is
removed from `data` **and** `meta`, at any nesting depth (nested objects,
arrays, nested arrays), so no endpoint or nested payload structure can leak it.
Stripping is non-mutating (the handler's payload is never modified) and
cycle-safe: circular payloads terminate instead of crashing. Controllers that
return an explicitly shaped `{ success: ... }` body keep it as-is — they own
their own envelope contract.

### Correlation / trace metadata

- Every request receives a correlation ID (`x-correlation-id` header) —
  inbound values are validated (RFC 4122 UUID) and replaced with a fresh
  UUID if missing or malformed.
- The header is returned on **both** successful and error responses, so
  callers can quote it when reporting issues.
- When a request targets a single entity (`:id`, `:claimId`, `:policyId`, …),
  an `x-entity-id` header is added as well.
- Error bodies include the same ID as `error.requestId`.
- The correlation ID is also stamped onto every log line, audit record
  (`audit_logs.correlation_id`), and notification payload emitted while the
  request is in flight — see `src/common/tracing/tracing-context.ts`.

### Internal metadata & admin behavior

Serialization is uniform across all endpoints: there is no separate
public/internal response path, and authorized admin flows are not given a
"raw" response shape. Internal metadata (correlation IDs, tracing scope,
audit trails) is preserved server-side for operational debugging and never
included in public response bodies. Error responses never include stack
traces or internal exception details — clients only ever receive the
standardized `ErrorResponseDto`.

## 🏗️ Database Architecture

**Prisma is the single source of truth** for all database access across this application:

- All models (User, InsurancePolicy, Claim, InsurancePool, Project, Notification, etc.) are defined in `prisma/schema.prisma`
- All services inject `PrismaService` from `DatabaseModule` for data access
- All schema migrations use `prisma/migrations/` with Prisma CLI tools
- Zero TypeORM or other ORM dependencies

This decision ensures:

- ✅ Consistent data access patterns across all domains
- ✅ Unified schema management and migration strategy
- ✅ Simplified onboarding and maintenance
- ✅ Reduced risk of data consistency bugs

For migration details, see [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md).

🧑‍💻 Tech Stack

Framework: NestJS

Language: TypeScript

Runtime: Node.js 18+

Database: PostgreSQL or MongoDB

Cache: Redis

Testing: Jest, Supertest

Deployment: Docker, Cloud providers

📦 Installation & Setup

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL 15+
- Redis 7+
- Docker and Docker Compose (for local development)

## Environment Configuration

This section documents all environment variables used by the backend. Variables are grouped by service/component.

### Quick Start

```bash
# Copy the example environment file
cp .env.example .env

Example environment variables:
# Edit .env with your local configuration
# Required variables must be set before starting the application
```

---

### Application Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | ✅ Yes | - | Environment mode: `development`, `production`, or `test` |
| `PORT` | ✅ Yes | `3000` | HTTP port for the application server |
| `API_PREFIX` | ✅ Yes | `api` | Global API prefix (e.g., `/api/v1/users`) |
| `ENCRYPTION_KEYS` | ✅ Yes | - | Format: `KEY_ID:base64_key`. Generate with: `openssl rand -base64 32` |

**Example:**
```bash
NODE_ENV=development
PORT=4000
API_PREFIX=api
ENCRYPTION_KEYS=v1:YOUR_BASE64_ENCRYPTION_KEY_HERE
```

---

### PostgreSQL Database Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_HOST` | ✅ Yes | - | PostgreSQL server hostname |
| `DATABASE_PORT` | ✅ Yes | - | PostgreSQL server port (typically `5432`) |
| `DATABASE_USERNAME` | ✅ Yes | - | PostgreSQL username |
| `DATABASE_PASSWORD` | ✅ Yes | - | PostgreSQL password |
| `DATABASE_NAME` | ✅ Yes | - | Database name |
| `DATABASE_SSL_ENABLED` | No | `false` | Enable SSL/TLS for database connections (set `true` in production) |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | No | `false` | Reject unauthorized SSL certificates |
| `DATABASE_SSL_CA` | No | - | Path to CA certificate file |
| `DATABASE_SSL_CERT` | No | - | Path to client certificate file |
| `DATABASE_SSL_KEY` | No | - | Path to client key file |
| `DATABASE_POOL_MIN` | No | `2` | Minimum number of connections in pool |
| `DATABASE_POOL_MAX` | No | `10` | Maximum number of connections in pool |
| `DATABASE_POOL_IDLE_TIMEOUT` | No | `30000` | Time (ms) before idle connection is removed |
| `DATABASE_POOL_CONNECTION_TIMEOUT` | No | `2000` | Time (ms) to wait for connection before timeout |
| `DATABASE_RETRY_ATTEMPTS` | No | `3` | Number of retry attempts for initial connection |
| `DATABASE_RETRY_DELAY` | No | `1000` | Initial delay (ms) between retry attempts |
| `DATABASE_MAX_RETRY_DELAY` | No | `30000` | Maximum delay (ms) between retries (exponential backoff cap) |
| `DATABASE_LOGGING` | No | `error,warn` | Comma-separated log levels: `query,error,schema,warn,info,log,migration` or `all` |
| `DATABASE_MAX_QUERY_EXECUTION_TIME` | No | `1000` | Log warning if query exceeds this time (ms) |

**Example:**
```bash
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_secure_password
DATABASE_NAME=stellar_insured
DATABASE_SSL_ENABLED=false
DATABASE_LOGGING=error,warn,migration
```

**Production Note:** Enable SSL in production by setting `DATABASE_SSL_ENABLED=true` and `DATABASE_SSL_REJECT_UNAUTHORIZED=true`.

---

### Redis Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL (supports `redis://` and `rediss://` protocols) |
| `REDIS_DB` | No | `0` | Redis database index |
| `REDIS_TTL` | No | `3600` | Default TTL for cached items (seconds) |

**Example:**
```bash
REDIS_URL=redis://localhost:6379
REDIS_DB=0
REDIS_TTL=3600
```

**Used by:** Caching, rate limiting, Bull queue (background jobs)

---

### Bull Queue Configuration

Bull uses Redis for job queue management. Configure using the Redis variables above.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EMAIL_QUEUE_MAX_ATTEMPTS` | No | `5` | Maximum retry attempts for email delivery jobs |
| `PUSH_QUEUE_MAX_ATTEMPTS` | No | `5` | Maximum retry attempts for push notification jobs |

**Example:**
```bash
EMAIL_QUEUE_MAX_ATTEMPTS=5
PUSH_QUEUE_MAX_ATTEMPTS=5
```

**Used by:** Background job processing for email notifications, web push notifications, and IPFS pinning.

---

### AWS S3 Storage Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_REGION` | ✅ Yes | - | AWS region (e.g., `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | ✅ Yes | - | AWS access key ID |
| `AWS_SECRET_ACCESS_KEY` | ✅ Yes | - | AWS secret access key |
| `AWS_S3_BUCKET` | ✅ Yes | - | S3 bucket name for file storage |

**Example:**
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_S3_BUCKET=stellar-insured-storage
```

**Security Warning:** Never commit AWS credentials to version control. Use IAM roles in production environments.

---

### SendGrid Email Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENDGRID_API_KEY` | ✅ Yes | - | SendGrid API key for email delivery |
| `SENDGRID_FROM_EMAIL` | No | `noreply@novafund.xyz` | Default sender email address |

**Example:**
```bash
SENDGRID_API_KEY=SG.your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

**Security Warning:** Never commit SendGrid API keys to version control.

---

### Web Push Notifications (VAPID)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VAPID_PUBLIC_KEY` | ✅ Yes | - | VAPID public key for web push |
| `VAPID_PRIVATE_KEY` | ✅ Yes | - | VAPID private key for web push |
| `VAPID_SUBJECT_EMAIL` | No | `admin@novafund.xyz` | VAPID subject email (contact email) |

**Generate VAPID keys:**
```bash
npx web-push generate-vapid-keys
```

**Example:**
```bash
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT_EMAIL=admin@yourdomain.com
```

**Security Warning:** Never commit VAPID private keys to version control.

---

### Stellar Network Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STELLAR_NETWORK` | ✅ Yes | - | Network name: `testnet`, `mainnet`, or `standalone` |
| `STELLAR_HORIZON_URL` | ✅ Yes | - | Horizon API URL (e.g., `https://horizon-testnet.stellar.org`) |
| `STELLAR_RPC_URL` | ✅ Yes | - | Soroban RPC URL (e.g., `https://soroban-testnet.stellar.org`) |
| `STELLAR_NETWORK_PASSPHRASE` | ✅ Yes | - | Network passphrase (e.g., `Test SDF Network ; September 2015`) |
| `PROJECT_LAUNCH_CONTRACT_ID` | ✅ Yes | - | Stellar smart contract ID for project launches |
| `ESCROW_CONTRACT_ID` | ✅ Yes | - | Stellar smart contract ID for escrow operations |
| `PROFIT_DISTRIBUTION_CONTRACT_ID` | No | - | Stellar contract ID for profit distribution |
| `SUBSCRIPTION_POOL_CONTRACT_ID` | No | - | Stellar contract ID for subscription pools |
| `GOVERNANCE_CONTRACT_ID` | No | - | Stellar contract ID for governance |
| `REPUTATION_CONTRACT_ID` | No | - | Stellar contract ID for reputation scoring |

**Example (Testnet):**
```bash
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
PROJECT_LAUNCH_CONTRACT_ID=CA...
ESCROW_CONTRACT_ID=CB...
```

**Security Warning:** Never commit mainnet secret keys or production contract IDs to public repositories.

---

### Stellar Event Indexer Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `INDEXER_POLL_INTERVAL_MS` | ✅ Yes | - | Polling interval for event indexing (milliseconds) |
| `INDEXER_START_LEDGER` | No | - | Ledger number to start indexing from (omit to use latest) |
| `INDEXER_REORG_DEPTH_THRESHOLD` | No | `5` | Number of ledgers to consider for reorganization detection |
| `INDEXER_MAX_EVENTS_PER_FETCH` | No | `100` | Maximum events to fetch per indexer poll |

**Example:**
```bash
INDEXER_POLL_INTERVAL_MS=5000
INDEXER_REORG_DEPTH_THRESHOLD=5
INDEXER_MAX_EVENTS_PER_FETCH=100
```

---

### IPFS Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `IPFS_HOST` | No | `localhost` | IPFS node hostname |
| `IPFS_PORT` | No | `5001` | IPFS API port |
| `IPFS_PROTOCOL` | No | `http` | IPFS API protocol (`http` or `https`) |

**Example:**
```bash
IPFS_HOST=localhost
IPFS_PORT=5001
IPFS_PROTOCOL=http
```

---

### Authentication & JWT Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | ✅ Yes | - | JWT signing secret (minimum 32 characters) |
| `JWT_REFRESH_SECRET` | No | - | Refresh token signing secret (minimum 32 characters) |
| `JWT_EXPIRATION` | ✅ Yes | - | JWT expiration time in seconds |
| `JWT_ACCESS_TOKEN_TTL` | No | `15m` | Access token TTL (e.g., `15m`, `1h`) |
| `JWT_REFRESH_TOKEN_TTL` | No | `7d` | Refresh token TTL (e.g., `7d`, `30d`) |
| `JWT_REFRESH_TOKEN_TTL_DAYS` | No | `7` | Refresh token TTL in days |
| `AUTH_MAX_SESSIONS_PER_USER` | No | `5` | Maximum concurrent sessions per user |
| `BCRYPT_SALT_ROUNDS` | No | `12` | Bcrypt salt rounds for password hashing |
| `TOKEN_ROTATION_ENABLED` | No | `true` | Enable automatic token rotation |

**Generate JWT secrets:**
```bash
openssl rand -base64 48
```

**JWT Secret Requirements (enforced by `env.validation.ts`):**
- **Minimum length:** 32 characters
- **Production complexity requirements:**
  - Must contain at least one uppercase letter
  - Must contain at least one lowercase letter
  - Must contain at least one digit
  - Must contain at least one special character
- **Forbidden values:** Placeholder values like `your-jwt-secret-key-change-in-production`, `secret`, `changeme`, `password`

**Example:**
```bash
JWT_SECRET=your_generated_secret_from_openssl_command_above_minimum_32_chars
JWT_REFRESH_SECRET=another_generated_secret_from_openssl_command_above
JWT_EXPIRATION=86400
JWT_ACCESS_TOKEN_TTL=15m
JWT_REFRESH_TOKEN_TTL=7d
JWT_REFRESH_TOKEN_TTL_DAYS=7
AUTH_MAX_SESSIONS_PER_USER=5
BCRYPT_SALT_ROUNDS=12
```

**Security Warning:** 
- JWT secrets MUST be at least 32 characters and meet complexity requirements in production
- Never use placeholder values
- Never commit real secrets to version control
- Generate strong secrets using `openssl rand -base64 48`

---

### Logging Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOG_LEVEL` | No | `info` | Logging level: `error`, `warn`, `info`, `debug`, `verbose` |
| `LOG_FORMAT` | No | `json` | Log format: `json` or `simple` |
| `LOG_DIR` | No | `logs` | Directory for log files |
| `SERVICE_NAME` | No | `stellar-insured-backend` | Service name in log metadata |

**Example:**
```bash
LOG_LEVEL=debug
LOG_FORMAT=json
LOG_DIR=logs
SERVICE_NAME=stellar-insured-backend
```

---

### CORS Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:3000,http://localhost:4200` | Comma-separated list of allowed origins |
| `CORS_CREDENTIALS` | No | `true` | Allow credentials in CORS requests |

**Example:**
```bash
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4200,https://yourdomain.com
CORS_CREDENTIALS=true
```

---

### Timeout Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REQUEST_TIMEOUT_MS` | No | `30000` | Maximum time (ms) for a request to complete |
| `HEADERS_TIMEOUT_MS` | No | `60000` | Time (ms) to wait for headers (must be < `KEEP_ALIVE_TIMEOUT_MS`) |
| `KEEP_ALIVE_TIMEOUT_MS` | No | `65000` | Time (ms) to keep idle connections open |
| `SHUTDOWN_TIMEOUT` | No | `30000` | Graceful shutdown timeout (ms) |

**Example:**
```bash
REQUEST_TIMEOUT_MS=30000
HEADERS_TIMEOUT_MS=60000
KEEP_ALIVE_TIMEOUT_MS=65000
SHUTDOWN_TIMEOUT=30000
```

---

### Rate Limiting Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `THROTTLE_DEFAULT_TTL` | No | `900000` | Default throttle window (ms) - 15 minutes |
| `THROTTLE_DEFAULT_LIMIT` | No | `100` | Default requests per window |
| `THROTTLE_AUTH_TTL` | No | `900000` | Auth endpoints throttle window (ms) |
| `THROTTLE_AUTH_LIMIT` | No | `5` | Auth endpoints requests per window |
| `THROTTLE_PUBLIC_TTL` | No | `60000` | Public endpoints throttle window (ms) |
| `THROTTLE_PUBLIC_LIMIT` | No | `50` | Public endpoints requests per window |
| `THROTTLE_ADMIN_TTL` | No | `60000` | Admin endpoints throttle window (ms) |
| `THROTTLE_ADMIN_LIMIT` | No | `100` | Admin endpoints requests per window |
| `THROTTLE_CLAIMS_TTL` | No | `3600000` | Claims submission throttle window (ms) - 1 hour |
| `THROTTLE_CLAIMS_LIMIT` | No | `10` | Claims submissions per window |
| `RATE_LIMIT_REDIS_ENABLED` | No | `false` | Use Redis for distributed rate limiting |
| `RATE_LIMIT_SLIDING_WINDOW_ENABLED` | No | `true` | Enable sliding window algorithm |
| `RATE_LIMIT_CIRCUIT_BREAKER_ENABLED` | No | `true` | Enable circuit breaker functionality |
| `RATE_LIMIT_CIRCUIT_BREAKER_FAILURE_THRESHOLD` | No | `10` | Failures before opening circuit |
| `RATE_LIMIT_CIRCUIT_BREAKER_TIMEOUT_MS` | No | `300000` | Circuit breaker timeout (ms) |
| `RATE_LIMIT_PER_USER_ENABLED` | No | `true` | Enable per-user rate limiting |
| `RATE_LIMIT_PER_IP_ENABLED` | No | `true` | Enable per-IP rate limiting |

**Example:**
```bash
THROTTLE_DEFAULT_TTL=900000
THROTTLE_DEFAULT_LIMIT=100
THROTTLE_AUTH_TTL=900000
THROTTLE_AUTH_LIMIT=5
RATE_LIMIT_REDIS_ENABLED=true
```

---

### Cache Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CACHE_DEFAULT_TTL` | No | `300` | Default cache TTL (seconds) |
| `CACHE_MAX_ITEMS` | No | `10000` | Maximum items in cache |
| `CACHE_KEY_PREFIX` | No | `app_cache:` | Cache key prefix |

**Example:**
```bash
CACHE_DEFAULT_TTL=300
CACHE_MAX_ITEMS=10000
CACHE_KEY_PREFIX=app_cache:
```

---

### Swagger Documentation

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SWAGGER_ENABLED` | No | `true` | Enable/disable Swagger UI |
| `SWAGGER_PATH` | No | `/api/docs` | Swagger UI path |

**Example:**
```bash
SWAGGER_ENABLED=true
SWAGGER_PATH=/api/docs
```

---

## Local Development Setup

### Using Docker Compose (Recommended)

The project includes a `docker-compose.yml` file that starts PostgreSQL and Redis for local development.

**Services started:**
- **PostgreSQL 15** on port `5432`
- **Redis** on port `6379`
- **RabbitMQ** (optional) on ports `5672` (AMQP) and `15672` (Management UI)

**Start services:**
```bash
docker-compose up -d
```

**Environment variables for Docker Compose:**
```bash
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=stellar_insured
REDIS_URL=redis://localhost:6379
```

**Stop services:**
```bash
docker-compose down
```

**View logs:**
```bash
docker-compose logs -f
```

### Running the Backend

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate:dev

# Start in development mode (with auto-reload)
npm run start:dev

# Start in production mode
npm run build
npm run start:prod
```

### Database Migrations

```bash
# Create a new migration
npm run prisma:migrate:generate -- your_migration_name

# Apply migrations to development database
npm run prisma:migrate:dev

# Apply migrations to production database
npm run prisma:migrate:deploy

# Reset database (WARNING: destroys data)
npm run prisma:migrate:reset

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

---

## Production Deployment Checklist

Before deploying to production, ensure:

### Security
- [ ] `NODE_ENV=production`
- [ ] Strong JWT secrets (minimum 32 chars, meeting complexity requirements)
- [ ] `DATABASE_SSL_ENABLED=true`
- [ ] `DATABASE_SSL_REJECT_UNAUTHORIZED=true`
- [ ] AWS credentials use IAM roles (not hardcoded keys)
- [ ] All secrets stored in secure secret manager (not in `.env` files)
- [ ] CORS origins restricted to production domains only
- [ ] SendGrid API key has appropriate permissions
- [ ] VAPID keys are production-specific

### Performance
- [ ] Database connection pool configured (`DATABASE_POOL_MIN`, `DATABASE_POOL_MAX`)
- [ ] Redis enabled for rate limiting (`RATE_LIMIT_REDIS_ENABLED=true`)
- [ ] Appropriate timeout values set
- [ ] Rate limits configured per endpoint requirements

### Monitoring
- [ ] `LOG_LEVEL=info` or `warn` (not `debug`)
- [ ] `DATABASE_LOGGING=error,warn,migration`
- [ ] Log directory configured and writable

### Stellar Configuration
- [ ] Mainnet Horizon and RPC URLs configured
- [ ] Production contract IDs deployed and verified
- [ ] Network passphrase matches mainnet

---

## Troubleshooting

### Missing Required Environment Variable

**Symptom:** Application fails to start with validation error.

**Solution:** Check `src/config/env.validation.ts` for required variables. Ensure all variables marked `@IsString()` without `@IsOptional()` are set in your `.env` file.

### Invalid JWT Secret

**Symptom:** Error: `JWT_SECRET must be at least 32 characters long` or `JWT_SECRET contains a placeholder value`.

**Cause:** JWT secret is too short or uses a forbidden placeholder value.

**Solution:** 
```bash
# Generate a strong secret
openssl rand -base64 48

# Set in .env
JWT_SECRET=<generated_secret>
JWT_REFRESH_SECRET=<another_generated_secret>
```

### PostgreSQL Connection Failure

**Symptom:** `Error: connect ECONNREFUSED` or `FATAL: password authentication failed`.

**Solution:**
1. Verify PostgreSQL is running: `docker-compose ps`
2. Check credentials in `.env` match `docker-compose.yml`
3. Ensure `DATABASE_HOST=localhost` (not `postgres` container name)
4. Check port is not already in use: `lsof -i :5432`

### Redis Connection Failure

**Symptom:** `Error: connect ECONNREFUSED 127.0.0.1:6379`.

**Solution:**
1. Verify Redis is running: `docker-compose ps`
2. Check `REDIS_URL=redis://localhost:6379` in `.env`
3. Check port is not already in use: `lsof -i :6379`

### Invalid S3 Configuration

**Symptom:** `AccessDenied` or `SignatureDoesNotMatch` errors.

**Solution:**
1. Verify AWS credentials are correct
2. Check IAM permissions for S3 bucket access
3. Verify `AWS_S3_BUCKET` name is correct
4. Ensure `AWS_REGION` matches bucket region

### SendGrid Email Delivery Failure

**Symptom:** Emails not being delivered, `401 Unauthorized`.

**Solution:**
1. Verify `SENDGRID_API_KEY` is correct
2. Check API key has `Mail Send` permissions in SendGrid dashboard
3. Verify sender email is verified in SendGrid
4. Check Bull queue logs: Queue jobs may be retrying

### Stellar Horizon/RPC Connection Failure

**Symptom:** `Network Error` or `Timeout` when connecting to Stellar.

**Solution:**
1. Verify `STELLAR_HORIZON_URL` and `STELLAR_RPC_URL` are correct
2. Check network connectivity to Stellar endpoints
3. Ensure `STELLAR_NETWORK_PASSPHRASE` matches the network
4. For testnet: Use `https://horizon-testnet.stellar.org`

### Rate Limiting Too Aggressive

**Symptom:** `429 Too Many Requests` errors during normal use.

**Solution:**
1. Review rate limit configuration in `.env`
2. Increase `THROTTLE_DEFAULT_LIMIT` for general endpoints
3. Increase specific limits (e.g., `THROTTLE_AUTH_LIMIT`, `THROTTLE_CLAIMS_LIMIT`)
4. Enable Redis-based rate limiting for distributed environments: `RATE_LIMIT_REDIS_ENABLED=true`

---

Running the Server

# Install dependencies

npm install

# Development mode

npm run start:dev

# Production mode

npm run start:prod

🧪 Testing

# Unit tests

npm run test

# End-to-end tests

npm run test:e2e

# Test coverage

npm run test:cov

🌐 API Documentation

Swagger UI: http://localhost:4000/api/docs

## 🏥 Health Checks

Robust health checks for all external dependencies enable reliable deployment orchestration, traffic routing, and incident triage.

### Endpoints

| Endpoint | Purpose | When 200 | When 207 | When 503 |
|----------|---------|----------|----------|----------|
| `GET /health/live` | Liveness | Process alive | Never | Process dead/hung |
| `GET /health/ready` | Readiness | All required deps up | N/A | Any required dep down |
| `GET /health` | Full status | All deps up | Required up, optional down | Any required dep down |

### Dependency Classification

| Dependency | Classification | Why | Health Check |
|-----------|---------------|-----|--------------|
| **PostgreSQL** | **REQUIRED** | All data access and persistence | `SELECT 1` within 3s |
| **Redis** | **REQUIRED** | Session management, caching, Bull queue backend | `PING` within 2s |
| **Bull Queue** | **REQUIRED** | Job processing (email, push, IPFS pinning) | `getJobCounts()` within 3s |
| S3 Storage | Optional | File uploads fail, but app continues | `HeadBucket` within 5s |
| SendGrid | Optional | Notification delivery may succeed later | API key validation within 5s |
| Memory | System | Process health | Heap < 512 MB |

### Health States

- **200 (Healthy)**: All required dependencies up; optional dependencies irrelevant
- **207 (Degraded)**: All required dependencies up; one or more optional dependencies down
- **503 (Unhealthy)**: One or more required dependencies down; app cannot process requests

### Usage Examples

#### Kubernetes Liveness & Readiness Probes

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 60
  periodSeconds: 30
  timeoutSeconds: 10
  failureThreshold: 3
```

#### Load Balancer Health Check

```bash
# Remove instance from rotation if readiness fails
curl -f http://localhost:3000/health/ready
```

#### Incident Triage

```bash
# Step 1: Check readiness (quick diagnosis)
curl http://localhost:3000/health/ready
# If 503: a required dependency is down

# Step 2: Get detailed status (identify which one)
curl http://localhost:3000/health
# Response includes per-dependency error details:
# {
#   "status": "error",
#   "info": { "database": {...}, "redis": {...}, "queue": {...} },
#   "error": { "database": { "error": "Connection refused" } }
# }
```

#### Operational Dashboard

```bash
# Full system status with all dependency details
curl http://localhost:3000/health | jq .

# Response structure:
# {
#   "status": "ok" | "degraded" | "error",
#   "info": {
#     "database": { "status": "up", "type": "postgresql", "message": "Database query successful" },
#     "redis": { "status": "up", "type": "redis", "message": "Redis PING successful" },
#     "queue": { "status": "up", "type": "bull", "jobCounts": { "active": 0, "waiting": 2, ... } },
#     "storage": { "status": "up", "type": "s3", "bucket": "my-bucket" },
#     "notifications": { "status": "up", "type": "sendgrid", "message": "SendGrid API key is valid" },
#     "memory_heap": { "status": "up" }
#   },
#   "error": {
#     "storage": { "status": "down", "error": "Connection timeout" }  # Only if degraded
#   }
# }
```

### Docker Compose

Health checks are pre-configured in `docker-compose.yml`:

```yaml
services:
  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d stellar_insured"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  redis:
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 10s

  app:
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health/ready"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

Start the stack with health checks:

```bash
docker-compose up
# App will not start until postgres and redis are healthy
# App will not mark as healthy until /health/ready returns 200
```

### Monitoring & Alerting

**Recommended alerts:**

- **Critical**: `/health/ready` returns 503 for > 2 minutes → page on-call
- **Warning**: `/health` returns 207 (degraded) for > 15 minutes → investigate optional dependency
- **Info**: Document `/health` response every minute for trend analysis

**Example Prometheus metrics scrape:**

```yaml
- job_name: 'stellar-insured-health'
  static_configs:
    - targets: ['localhost:3000']
  metrics_path: '/health'
  scrape_interval: 30s
```

### Troubleshooting

**503 Database down:**
```bash
curl http://localhost:3000/health
# Error: "Database health check timeout after 3000ms"
# → Check PostgreSQL is running: docker-compose ps postgres
# → Check connection string: echo $DATABASE_URL
```

**503 Redis down:**
```bash
curl http://localhost:3000/health
# Error: "Redis health check failed: Connection refused"
# → Check Redis is running: docker-compose ps redis
# → Check connection string: echo $REDIS_URL
```

**503 Bull Queue down:**
```bash
curl http://localhost:3000/health
# Error: "Bull queue health check failed: Redis connection refused"
# → Bull depends on Redis; fix Redis first
```

**207 S3 degraded:**
```bash
curl http://localhost:3000/health
# Status: degraded, storage error: "Invalid AWS credentials"
# → S3 is optional; app continues to function
# → Uploads will fail; fix AWS config when ready
# → Use: echo $AWS_S3_BUCKET to verify config
```

**207 SendGrid degraded:**
```bash
curl http://localhost:3000/health
# Status: degraded, notifications error: "SendGrid API key not configured"
# → SendGrid is optional; app continues
# → Queued notifications remain in queue; delivery will retry later
# → Fix: set notification.sendgrid.apiKey in config
```

⚠️ **Error Handling**

All endpoints return standardized error responses. Clients should inspect the
`errorCode` field (see `ERROR_CODES.md`) and present the accompanying
`message` to users. Transient failures are automatically retried by internal
clients and downstream circuits prevent cascading outages.

🤝 Contributing

Fork the repository

Create a feature branch

Add tests for new features

Open a Pull Request

📚 Resources

NestJS Docs: https://docs.nestjs.com

Stellar Docs: https://developers.stellar.org

Soroban Docs: https://soroban.stellar.org/docs
